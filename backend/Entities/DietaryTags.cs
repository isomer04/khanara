namespace Khanara.API.Entities;

[Flags]
public enum DietaryTags
{
    None = 0,
    Halal = 1,
    Vegetarian = 2,
    Vegan = 4,
    GlutenFree = 8,
    ContainsNuts = 16,
    ContainsDairy = 32
}
