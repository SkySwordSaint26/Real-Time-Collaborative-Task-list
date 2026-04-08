using System.ComponentModel.DataAnnotations;
namespace Project.Models

{
    public class Item
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Status { get; set; } = "Pending";


        public bool IsDeleted { get; set; }

        public int CreatedBy { get; set; }

        public virtual ICollection<FileAttachment> Files { get; set; } = new List<FileAttachment>();
    }

}
