using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Khanara.API.Helpers;

/// <summary>
/// Every entry must be a 5-digit US zip code. A null list is valid, so this
/// works for optional (PATCH-style) properties too.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed partial class ZipCodeListAttribute : ValidationAttribute
{
    public const int MaxCount = 50;

    [GeneratedRegex(@"^\d{5}$")]
    private static partial Regex ZipCodeRegex();

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not IEnumerable<string> zipCodes) return ValidationResult.Success;

        var list = zipCodes.ToList();
        if (list.Count > MaxCount)
            return new ValidationResult($"At most {MaxCount} service zip codes are allowed");

        var invalid = list.Where(z => z == null || !ZipCodeRegex().IsMatch(z)).ToList();
        return invalid.Count == 0
            ? ValidationResult.Success
            : new ValidationResult($"Service zip codes must be 5 digits: {string.Join(", ", invalid)}");
    }
}
