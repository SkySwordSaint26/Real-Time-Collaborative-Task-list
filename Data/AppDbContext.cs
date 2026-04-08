using Microsoft.EntityFrameworkCore;
using Project.Models;
namespace Project.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext() { }
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Users> Users { get; set; }
        public DbSet<Item> Items { get; set; }
        public DbSet<FileAttachment> Files { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
    }
}
