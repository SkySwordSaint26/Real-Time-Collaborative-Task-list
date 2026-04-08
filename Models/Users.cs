using System.ComponentModel.DataAnnotations;
namespace Project.Models

{
    public class Users
    {
            public int Id { get; set; }

            [Required]
            [MaxLength(50)]
            public string Name { get; set; } = string.Empty;

            [Required]
            [EmailAddress]
            [MaxLength(100)]
            public string Email { get; set; } = string.Empty;

            [Required]
            public string PasswordHash { get; set; } = string.Empty;

            [Required]
            [MaxLength(20)]
            public string Role { get; set; } = "User";


            public string? RefreshToken { get; set; }
            public DateTime? RefreshTokenExpiryTime { get; set; }
            public string? PasswordResetToken { get; set; }
            public DateTime? PasswordResetExpiry { get; set; }
    }

}
