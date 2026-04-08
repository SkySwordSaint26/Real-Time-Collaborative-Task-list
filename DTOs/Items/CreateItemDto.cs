using System.ComponentModel.DataAnnotations;

namespace Project.DTOs.Item
{
    public class CreateItemDto
    {
        [Required]
        [StringLength(100)]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;


        [Required]
        [RegularExpression("Pending|In Progress|Completed")]
        public string Status { get; set; } = "Pending";

    }
}
