using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Project.Data;
using System.Text;
using System.Threading.RateLimiting;
using StackExchange.Redis;
using Microsoft.AspNetCore.Mvc;
using Project.Models;
using Project.DTOs.Auth;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Project.Hubs;
using Project.DTOs.Item;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Distributed;
using Project.DTOs.Common;
using Microsoft.AspNetCore.RateLimiting;
using System.Text.Json;







var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add Authentication & Authorization
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "TaskApi",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "TaskApiUsers",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "super_secret_fallback_key_that_is_at_least_32_bytes_long")),
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddSignalR();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        var frontendUrl = builder.Configuration["FrontendUrl"] ?? "*";
        if (frontendUrl == "*") policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        else policy.WithOrigins(frontendUrl).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

// Rate Limiting Configuration
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // authGroup Policy (Strict)
    options.AddFixedWindowLimiter("AuthPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = builder.Configuration.GetValue<int>("RateLimiting:AuthLimit");
        opt.QueueLimit = 0;
    });

    // itemsGroup & usersGroup Policy (Moderate)
    options.AddFixedWindowLimiter("ApiPolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = builder.Configuration.GetValue<int>("RateLimiting:ApiLimit");
        opt.QueueLimit = 10;
    });

    // File Upload Policy (Very Strict)
    options.AddFixedWindowLimiter("FilePolicy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = builder.Configuration.GetValue<int>("RateLimiting:FileLimit");
        opt.QueueLimit = 0;
    });
});

// Redis Configuration
var redisConn = builder.Configuration["Redis"] ?? "localhost:6379";
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConn));
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConn;
    options.InstanceName = "TaskApi:";
});





var app = builder.Build();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// 15. Sunset Header Middleware
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/v1"))
    {
        context.Response.Headers["Sunset"] = "Thu, 31 Dec 2026 23:59:59 GMT";
    }
    await next();
});

app.MapHub<TaskHub>("/taskhub").RequireAuthorization();



app.MapGet("/", () => "API is running!");

// =======================
// AUTH ENDPOINTS
// =======================
var authGroup = app.MapGroup("/api/v1/auth").RequireRateLimiting("AuthPolicy");

authGroup.MapPost("/register", async ([FromBody] RegisterDto dto, AppDbContext db, IConnectionMultiplexer redis) =>
{
    // 5. Input Sanitization
    dto.Username = dto.Username.Trim();
    dto.Email = dto.Email.Trim();
    dto.Password = dto.Password.Trim();

    if (await db.Users.AnyAsync(u => u.Name == dto.Username)) 
        return Results.BadRequest(new { Message = "User already exists" });
    
    // Validate email format
    if (string.IsNullOrEmpty(dto.Email) || !dto.Email.Contains("@"))
        return Results.BadRequest("Invalid email format");
    
    // Default role is "User" - only admins can assign other roles via the role assign endpoint
    var user = new Users 
    { 
        Name = dto.Username, 
        Email = dto.Email, 
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password), 
        Role = "User"
    };
    
    db.Users.Add(user);
    await db.SaveChangesAsync();

    // Invalidate User List
    await redis.GetDatabase().StringIncrementAsync("Users_Version");

    return Results.Ok(new { Message = "Registered successfully", UserId = user.Id });

});

authGroup.MapPost("/login", async ([FromBody] LoginDto dto, AppDbContext db, IConfiguration config) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Name == dto.Username);
    if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash)) 
        return Results.Unauthorized();
    
    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.UTF8.GetBytes(config["Jwt:Key"] ?? "super_secret_fallback_key_that_is_at_least_32_bytes_long");
    
    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString() ?? string.Empty),
            new Claim(ClaimTypes.Name, user.Name ?? string.Empty),
            new Claim(ClaimTypes.Role, user.Role ?? "User")
        }),
        Expires = DateTime.UtcNow.AddHours(2),
        Issuer = config["Jwt:Issuer"] ?? "TaskApi",
        Audience = config["Jwt:Audience"] ?? "TaskApiUsers",
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };
    
    var token = tokenHandler.CreateToken(tokenDescriptor);
    return Results.Ok(new { Token = tokenHandler.WriteToken(token) });
});

authGroup.MapPost("/refresh-token", async ([FromBody] TokenDto dto, AppDbContext db, IConfiguration config) =>
{
    var refreshToken = await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == dto.RefreshToken);
    if (refreshToken == null || refreshToken.ExpiryDate < DateTime.UtcNow)
        return Results.Unauthorized();

    var user = await db.Users.FindAsync(refreshToken.UserId);
    if (user == null)
        return Results.Unauthorized();

    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.UTF8.GetBytes(config["Jwt:Key"] ?? "super_secret_fallback_key_that_is_at_least_32_bytes_long");

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString() ?? string.Empty),
            new Claim(ClaimTypes.Name, user.Name ?? string.Empty),
            new Claim(ClaimTypes.Role, user.Role ?? "User")
        }),
        Expires = DateTime.UtcNow.AddHours(2),
        Issuer = config["Jwt:Issuer"] ?? "TaskApi",
        Audience = config["Jwt:Audience"] ?? "TaskApiUsers",
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };

    var newToken = tokenHandler.CreateToken(tokenDescriptor);
    return Results.Ok(new { Token = tokenHandler.WriteToken(newToken) });
});

authGroup.MapPost("/logout", async ([FromBody] TokenDto dto, AppDbContext db) =>
{
    var refreshToken = await db.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == dto.RefreshToken);
    if (refreshToken != null)
    {
        db.RefreshTokens.Remove(refreshToken);
        await db.SaveChangesAsync();
    }
    return Results.Ok(new { Message = "Logged out successfully" });
});

authGroup.MapPost("/password-reset/initiate", async ([FromBody] EmailDto dto, AppDbContext db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
    if (user == null)
        return Results.NotFound("User not found");

    var resetToken = Guid.NewGuid().ToString();
    user.PasswordResetToken = resetToken;
    user.PasswordResetExpiry = DateTime.UtcNow.AddHours(1);
    await db.SaveChangesAsync();

    // TODO: Send resetToken to user's email

    return Results.Ok(new { Message = "Password reset token sent to email" });
});

authGroup.MapPost("/password-reset/complete", async ([FromBody] PasswordResetDto dto, AppDbContext db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == dto.Token && u.PasswordResetExpiry > DateTime.UtcNow);
    if (user == null)
        return Results.BadRequest("Invalid or expired token");

    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
    user.PasswordResetToken = null;
    user.PasswordResetExpiry = null;
    await db.SaveChangesAsync();

    return Results.Ok(new { Message = "Password reset successful" });
});

// =======================
// ROLES ENDPOINTS
// =======================
authGroup.MapPost("/roles/assign", async ([FromBody] RoleAssignmentDto dto, AppDbContext db) =>
{
    var user = await db.Users.FindAsync(dto.UserId);
    if (user == null)
        return Results.NotFound("User not found");

    user.Role = dto.Role;
    await db.SaveChangesAsync();

    return Results.Ok(new { Message = "Role assigned successfully" });
}).RequireAuthorization(p => p.RequireRole("Admin"));

authGroup.MapGet("/roles", async (AppDbContext db) =>
{
    var roles = await db.Users.Select(u => new { u.Id, u.Name, u.Role }).ToListAsync();
    return Results.Ok(roles);
}).RequireAuthorization(p => p.RequireRole("Admin"));

// =======================
// USERS ENDPOINTS
// =======================
var usersGroup = app.MapGroup("/api/v1/users").RequireAuthorization().RequireRateLimiting("ApiPolicy");

usersGroup.MapGet("/", async (AppDbContext db, IDistributedCache cache, IConnectionMultiplexer redis) =>
{
    var dbRedis = redis.GetDatabase();
    var version = await dbRedis.StringGetAsync("Users_Version");
    if (version.IsNullOrEmpty) {
        await dbRedis.StringSetAsync("Users_Version", "1");
        version = "1";
    }

    string cacheKey = $"Users:v{version}";
    var cachedData = await cache.GetStringAsync(cacheKey);
    if (!string.IsNullOrEmpty(cachedData))
    {
        return Results.Ok(JsonSerializer.Deserialize<List<Users>>(cachedData));
    }

    var users = await db.Users.ToListAsync();
    await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(users), new DistributedCacheEntryOptions {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    });

    return Results.Ok(users);
}).RequireAuthorization(p => p.RequireRole("Admin"));


usersGroup.MapGet("/{id}", async (int id, AppDbContext db, IDistributedCache cache) =>
{
    string cacheKey = $"User:{id}";
    var cachedData = await cache.GetStringAsync(cacheKey);
    if (!string.IsNullOrEmpty(cachedData))
    {
        return Results.Ok(JsonSerializer.Deserialize<Users>(cachedData));
    }

    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();

    await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(user), new DistributedCacheEntryOptions {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    });
    
    return Results.Ok(user);
}).RequireAuthorization();


usersGroup.MapPut("/{id}", async (int id, [FromBody] Users updatedUser, ClaimsPrincipal currentUser, AppDbContext db, IConnectionMultiplexer redis, IDistributedCache cache) =>
{
    var currentUserId = int.Parse(currentUser.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var isAdmin = currentUser.IsInRole("Admin");

    if (id != currentUserId && !isAdmin)
        return Results.Forbid();

    // 5. Sanitization
    updatedUser.Name = updatedUser.Name.Trim();
    updatedUser.Email = updatedUser.Email.Trim();

    var user = await db.Users.FindAsync(id);

    if (user is null) return Results.NotFound();
    
    user.Name = updatedUser.Name;
    user.Email = updatedUser.Email;

    if (isAdmin) {
        user.Role = updatedUser.Role;
    }
    
    await db.SaveChangesAsync();

    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Users_Version");
    await cache.RemoveAsync($"User:{id}");
    await cache.RemoveAsync($"Profile:{id}");

    return Results.NoContent();

}).RequireAuthorization();

usersGroup.MapDelete("/{id}", async (int id, ClaimsPrincipal currentUser, AppDbContext db, IConnectionMultiplexer redis, IDistributedCache cache) =>

{
    var currentUserId = int.Parse(currentUser.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var isAdmin = currentUser.IsInRole("Admin");

    if (id != currentUserId && !isAdmin)
        return Results.Forbid();

    var user = await db.Users.FindAsync(id);
    if (user is null) return Results.NotFound();
    
    db.Users.Remove(user);
    await db.SaveChangesAsync();

    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Users_Version");
    await cache.RemoveAsync($"User:{id}");
    await cache.RemoveAsync($"Profile:{id}");

    return Results.NoContent();

}).RequireAuthorization();

// =======================
// PROFILE ENDPOINTS
// =======================
usersGroup.MapGet("/profile", async (ClaimsPrincipal user, AppDbContext db, IDistributedCache cache) =>
{
    var userId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    string cacheKey = $"Profile:{userId}";
    var cachedData = await cache.GetStringAsync(cacheKey);
    if (!string.IsNullOrEmpty(cachedData))
    {
        return Results.Ok(JsonSerializer.Deserialize<object>(cachedData));
    }

    var userProfile = await db.Users.FindAsync(userId);
    if (userProfile == null)
        return Results.NotFound("User not found");

    var profileData = new { userProfile.Name, userProfile.Email, userProfile.Role };
    await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(profileData), new DistributedCacheEntryOptions {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    });

    return Results.Ok(profileData);
}).RequireAuthorization();


usersGroup.MapPut("/profile", async ([FromBody] UpdateProfileDto dto, ClaimsPrincipal user, AppDbContext db, IConnectionMultiplexer redis, IDistributedCache cache) =>
{
    // 5. Sanitization
    dto.Name = dto.Name.Trim();
    dto.Email = dto.Email.Trim();

    var userId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

    var userProfile = await db.Users.FindAsync(userId);
    if (userProfile == null)
        return Results.NotFound("User not found");

    userProfile.Name = dto.Name;
    userProfile.Email = dto.Email;
    await db.SaveChangesAsync();

    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Users_Version");
    await cache.RemoveAsync($"User:{userId}");
    await cache.RemoveAsync($"Profile:{userId}");

    return Results.Ok(new { Message = "Profile updated successfully" });

}).RequireAuthorization();

// =======================
// ITEMS ENDPOINTS
// =======================
var itemsGroup = app.MapGroup("/api/v1/items").RequireAuthorization().RequireRateLimiting("ApiPolicy");

itemsGroup.MapGet("/", async (AppDbContext db, IDistributedCache cache, IConnectionMultiplexer redis, [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? search, [FromQuery] string? status) => 
{
    int currentPage = page ?? 1;
    int size = pageSize ?? 10;

    // 1. Get current version for items
    var dbRedis = redis.GetDatabase();
    var version = await dbRedis.StringGetAsync("Items_Version");
    if (version.IsNullOrEmpty) {
        await dbRedis.StringSetAsync("Items_Version", "1");
        version = "1";
    }

    // 2. Try Cache (Include status in key)
    string cacheKey = $"Items:v{version}:p{currentPage}:s{size}:q{search ?? ""}:st{status ?? ""}";
    var cachedData = await cache.GetStringAsync(cacheKey);
    if (!string.IsNullOrEmpty(cachedData))
    {
        return Results.Ok(JsonSerializer.Deserialize<PagedResponse<ItemDto>>(cachedData));
    }

    // 3. Database Fetch with Filtering and Eager Loading
    var query = db.Items
        .Include(i => i.Files) // 12. Eager Loading
        .Where(i => !i.IsDeleted)
        .AsQueryable();

    if (!string.IsNullOrEmpty(search)) {
        var term = search.ToLower();
        query = query.Where(i => i.Title.ToLower().Contains(term) || i.Description.ToLower().Contains(term));
    }

    if (!string.IsNullOrEmpty(status)) {
        query = query.Where(i => i.Status == status);
    }
    
    var totalItems = await query.CountAsync();
    var totalPages = (int)Math.Ceiling(totalItems / (double)size);

    var items = await query.Skip((currentPage - 1) * size).Take(size).Select(i => new ItemDto {
        Id = i.Id,
        Title = i.Title,
        Description = i.Description,
        Status = i.Status,
        IsDeleted = i.IsDeleted,
        CreatedBy = i.CreatedBy,
        Files = i.Files.Select(f => new FileDto { Id = f.Id, FileName = f.FileName, FilePath = f.FilePath }).ToList()
    }).ToListAsync();

    var response = new PagedResponse<ItemDto> {
        TotalItems = totalItems,
        TotalPages = totalPages,
        CurrentPage = currentPage,
        PageSize = size,
        Items = items
    };

    // 4. Cache Store
    await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(response), new DistributedCacheEntryOptions {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    });

    return Results.Ok(response);
});



itemsGroup.MapGet("/{id}", async (int id, AppDbContext db, IDistributedCache cache) =>
{
    string cacheKey = $"Item:{id}";
    var cachedData = await cache.GetStringAsync(cacheKey);
    if (!string.IsNullOrEmpty(cachedData))
    {
        return Results.Ok(JsonSerializer.Deserialize<ItemDto>(cachedData));
    }

    var item = await db.Items
        .Include(i => i.Files)
        .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);

    if (item == null) return Results.NotFound();
    
    var itemDto = new ItemDto {
        Id = item.Id,
        Title = item.Title,
        Description = item.Description,
        Status = item.Status,
        IsDeleted = item.IsDeleted,
        CreatedBy = item.CreatedBy,
        Files = item.Files.Select(f => new FileDto { Id = f.Id, FileName = f.FileName, FilePath = f.FilePath }).ToList()
    };

    await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(itemDto), new DistributedCacheEntryOptions {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    });
    
    return Results.Ok(itemDto);
});



itemsGroup.MapPost("/", async ([FromBody] CreateItemDto dto, AppDbContext db, IHubContext<TaskHub> hub, IConnectionMultiplexer redis, ClaimsPrincipal user) =>

{
    var userId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var item = new Item 
    { 
        Title = dto.Title, 
        Description = dto.Description, 
        CreatedBy = userId 
    };
    
    
    // 5. Input Sanitization
    item.Title = item.Title.Trim();
    item.Description = item.Description?.Trim();
    item.Status = item.Status?.Trim();

    db.Items.Add(item);
    await db.SaveChangesAsync();

    
    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Items_Version");

    
    var itemDto = new ItemDto {
        Id = item.Id,
        Title = item.Title,
        Description = item.Description,
        IsDeleted = item.IsDeleted,
        CreatedBy = item.CreatedBy
    };
    
    await hub.Clients.All.SendAsync("ReceiveTaskUpdate", "Created", itemDto);
    return Results.Created($"/api/v1/items/{item.Id}", itemDto);
});

itemsGroup.MapPut("/{id}", async (int id, [FromBody] UpdateItemDto dto, AppDbContext db, IHubContext<TaskHub> hub, IConnectionMultiplexer redis, IDistributedCache cache, ClaimsPrincipal user) =>


{
    var item = await db.Items
        .Include(i => i.Files)
        .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);
    if (item is null) return Results.NotFound();
    
    // All authorized users can change tasks as per user request
    // if (item.CreatedBy != currentUserId && !isAdmin)
    //    return Results.Forbid();
    
    item.Title = dto.Title.Trim();
    item.Description = dto.Description?.Trim();
    item.Status = dto.Status.Trim(); // 5. Sanitization
    
    try {
        await db.SaveChangesAsync();
    } catch (DbUpdateConcurrencyException) { // 11. Concurrency Control
        return Results.Conflict("The item was updated by another user. Please reload.");
    }

    
    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Items_Version");
    await cache.RemoveAsync($"Item:{id}");


    
    var itemDto = new ItemDto {
        Id = item.Id,
        Title = item.Title,
        Description = item.Description,
        Status = item.Status,
        IsDeleted = item.IsDeleted,
        CreatedBy = item.CreatedBy,
        Files = item.Files.Select(f => new FileDto { Id = f.Id, FileName = f.FileName, FilePath = f.FilePath }).ToList()
    };
    
    await hub.Clients.All.SendAsync("ReceiveTaskUpdate", "Updated", itemDto);
    return Results.Ok(itemDto);
});

itemsGroup.MapDelete("/{id}", async (int id, AppDbContext db, IHubContext<TaskHub> hub, IConnectionMultiplexer redis, IDistributedCache cache, ClaimsPrincipal user) =>


{
    var item = await db.Items
        .Include(i => i.Files)
        .FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);
    if (item is null) return Results.NotFound();
    
    var currentUserId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var isAdmin = user.IsInRole("Admin");

    if (item.CreatedBy != currentUserId && !isAdmin)
        return Results.Forbid();
    
    item.IsDeleted = true;
    await db.SaveChangesAsync();
    
    // Invalidate Cache
    await redis.GetDatabase().StringIncrementAsync("Items_Version");
    await cache.RemoveAsync($"Item:{id}");


    
    var itemDto = new ItemDto {
        Id = item.Id,
        Title = item.Title,
        Description = item.Description,
        Status = item.Status,
        IsDeleted = item.IsDeleted,
        CreatedBy = item.CreatedBy,
        Files = item.Files.Select(f => new FileDto { Id = f.Id, FileName = f.FileName, FilePath = f.FilePath }).ToList()
    };
    
    await hub.Clients.All.SendAsync("ReceiveTaskUpdate", "Deleted", itemDto);
    return Results.NoContent();
});



// =======================
// FILES ENDPOINTS
// =======================
itemsGroup.MapPost("/{id}/upload", async (int id, IFormFile file, AppDbContext db, IHubContext<TaskHub> hub, ClaimsPrincipal user) =>
{
    var item = await db.Items.FindAsync(id);
    if (item is null) return Results.NotFound();
    
    var currentUserId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var isAdmin = user.IsInRole("Admin");

    if (item.CreatedBy != currentUserId && !isAdmin)
        return Results.Forbid();

    if (file is null || file.Length == 0) return Results.BadRequest("No file uploaded");
    
    var attachment = new FileAttachment 
    { 
        ItemId = id, 
        FileName = file.FileName, 
        FilePath = "/uploads/" + file.FileName 
    };
    
    db.Files.Add(attachment);
    await db.SaveChangesAsync();

    await hub.Clients.All.SendAsync("ReceiveFileUpdate", "Uploaded", attachment);
    return Results.Ok(attachment);
}).DisableAntiforgery().RequireRateLimiting("FilePolicy");




app.MapGet("/api/v1/files/{filename}", (string filename) => 
{
    return Results.Ok(new { Message = $"Mock: Served file {filename}" });
});

app.MapDelete("/api/v1/files/{id}", async (int id, AppDbContext db, IHubContext<TaskHub> hub, ClaimsPrincipal user) =>
{
    var file = await db.Files.FindAsync(id);
    if (file is null) return Results.NotFound();
    
    var item = await db.Items.FindAsync(file.ItemId);
    if (item is null) return Results.NotFound();
    
    var currentUserId = int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    var isAdmin = user.IsInRole("Admin");

    if (item.CreatedBy != currentUserId && !isAdmin)
        return Results.Forbid();

    db.Files.Remove(file);
    await db.SaveChangesAsync();

    await hub.Clients.All.SendAsync("ReceiveFileUpdate", "Deleted", file);
    return Results.NoContent();
}).RequireAuthorization();

// 18. Database Seeding
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    if (!await db.Users.AnyAsync(u => u.Role == "Admin"))
    {
        var admin = new Users 
        { 
            Name = "Admin", 
            Email = "admin@taskapi.com", 
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"), 
            Role = "Admin" 
        };
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        // Sample Items
        var adminUser = await db.Users.FirstAsync(u => u.Email == "admin@taskapi.com");
        db.Items.Add(new Item { Title = "Seed Task 1", Description = "Sample description", Status = "Pending", CreatedBy = adminUser.Id });
        db.Items.Add(new Item { Title = "Seed Task 2", Description = "Another sample", Status = "In Progress", CreatedBy = adminUser.Id });
        
        await db.SaveChangesAsync();
    }
}

app.Run();

