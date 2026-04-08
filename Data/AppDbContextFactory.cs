using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Project.Data
{

    public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

            optionsBuilder.UseNpgsql(
                "Host=172.17.147.244;Port=5432;Database=dotnet;Username=shubham;Password=123"
            );

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
