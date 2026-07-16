using System.ComponentModel.DataAnnotations;

namespace Khanara.API.DTOs;

public class CreateReviewDto
{
    public int OrderId { get; set; }

    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(1000)]
    public string? Comment { get; set; }
}
