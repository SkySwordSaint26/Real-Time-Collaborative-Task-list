namespace Project.Models;

public class RefreshToken
{
    public int Id { get; set; }
    public string Token { get; set; }
    public DateTime ExpiryDate { get; set; }
    public int UserId { get; set; }
    public Users User { get; set; }
}