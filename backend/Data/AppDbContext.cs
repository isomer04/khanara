using Khanara.API.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Khanara.API.Data;

public class AppDbContext(DbContextOptions options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Photo> Photos { get; set; }
    public DbSet<Message> Messages { get; set; }
    public DbSet<CookProfile> CookProfiles { get; set; }
    public DbSet<Dish> Dishes { get; set; }
    public DbSet<DishPhoto> DishPhotos { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderItem> OrderItems { get; set; }
    public DbSet<StripeWebhookEvent> StripeWebhookEvents { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<Favorite> Favorites { get; set; }
    public DbSet<CartItem> CartItems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<IdentityRole>()
            .HasData(
                new IdentityRole { Id = "cook-id", Name = "Cook", NormalizedName = "COOK", ConcurrencyStamp = "1a2b3c4d-0001-0001-0001-000000000001" },
                new IdentityRole { Id = "eater-id", Name = "Eater", NormalizedName = "EATER", ConcurrencyStamp = "1a2b3c4d-0002-0002-0002-000000000002" },
                new IdentityRole { Id = "admin-id", Name = "Admin", NormalizedName = "ADMIN", ConcurrencyStamp = "1a2b3c4d-0003-0003-0003-000000000003" },
                new IdentityRole { Id = "moderator-id", Name = "Moderator", NormalizedName = "MODERATOR", ConcurrencyStamp = "1a2b3c4d-0004-0004-0004-000000000004" }
            );

        modelBuilder.Entity<AppUser>()
            .HasIndex(u => u.RefreshToken);

        modelBuilder.Entity<CookProfile>()
            .HasIndex(x => x.AppUserId)
            .IsUnique();

        modelBuilder.Entity<CookProfile>()
            .HasOne(x => x.AppUser)
            .WithOne(x => x.CookProfile)
            .HasForeignKey<CookProfile>(x => x.AppUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Order)
            .WithMany(o => o.Messages)
            .HasForeignKey(m => m.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.EaterUser)
            .WithMany()
            .HasForeignKey(o => o.EaterUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.CookProfile)
            .WithMany()
            .HasForeignKey(o => o.CookProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrderItem>()
            .HasOne(i => i.Dish)
            .WithMany()
            .HasForeignKey(i => i.DishId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StripeWebhookEvent>()
            .HasIndex(e => e.StripeEventId)
            .IsUnique();

        modelBuilder.Entity<Review>()
            .HasIndex(r => r.OrderId)
            .IsUnique();

        modelBuilder.Entity<Review>()
            .HasOne(r => r.Order)
            .WithMany()
            .HasForeignKey(r => r.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Review>()
            .HasOne(r => r.Author)
            .WithMany()
            .HasForeignKey(r => r.AuthorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Favorite>()
            .HasKey(f => new { f.EaterUserId, f.CookProfileId });

        modelBuilder.Entity<Favorite>()
            .HasOne(f => f.EaterUser)
            .WithMany()
            .HasForeignKey(f => f.EaterUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Favorite>()
            .HasOne(f => f.CookProfile)
            .WithMany()
            .HasForeignKey(f => f.CookProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CartItem>(entity =>
        {
            entity.HasIndex(c => c.UserId);

            entity.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(c => c.Dish)
                .WithMany()
                .HasForeignKey(c => c.DishId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(c => new { c.UserId, c.DishId })
                .IsUnique();

            entity.ToTable(tb => tb.HasCheckConstraint("CK_CartItems_Quantity", "Quantity >= 1 AND Quantity <= 100"));
        });

        modelBuilder.Entity<CookProfile>()
            .Property(c => c.AverageRating)
            .HasColumnType("decimal(3,2)");

        modelBuilder.Entity<Review>(entity =>
        {
            entity.ToTable(tb => tb.HasCheckConstraint("CK_Reviews_Rating", "Rating >= 1 AND Rating <= 5"));
        });

        var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
            v => v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        );

        var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue ? v.Value.ToUniversalTime() : null,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : null
        );

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(dateTimeConverter);
                else if (property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(nullableDateTimeConverter);
            }
        }
    }
}
