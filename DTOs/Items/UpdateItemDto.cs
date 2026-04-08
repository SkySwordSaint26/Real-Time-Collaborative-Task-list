using System.ComponentModel.DataAnnotations;

namespace Project.DTOs.Item
{
    public class UpdateItemDto
    {
        [Required]
        [StringLength(100)]
        public string Title { get; set; }

        public string Description { get; set; }

        [Required]
        [RegularExpression("Pending|In Progress|Completed")]
        public string Status { get; set; } = "Pending";

    }

}
