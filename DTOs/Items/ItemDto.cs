namespace Project.DTOs.Item
{
    public class ItemDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
        public int CreatedBy { get; set; }
        public List<FileDto> Files { get; set; } = new();
    }

    public class FileDto
    {
        public int Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
    }


}
