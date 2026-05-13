using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Khanara.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class CreateCartItemsTableIfNotExists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create CartItems table if it doesn't exist
            migrationBuilder.Sql(@"
                CREATE TABLE IF NOT EXISTS ""CartItems"" (
                    ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_CartItems"" PRIMARY KEY AUTOINCREMENT,
                    ""UserId"" TEXT NOT NULL,
                    ""DishId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""AddedAt"" TEXT NOT NULL,
                    ""UpdatedAt"" TEXT NOT NULL,
                    CONSTRAINT ""FK_CartItems_AspNetUsers_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""AspNetUsers"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_CartItems_Dishes_DishId"" FOREIGN KEY (""DishId"") REFERENCES ""Dishes"" (""Id"") ON DELETE RESTRICT
                );
            ");

            // Create indexes if they don't exist
            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_CartItems_DishId"" ON ""CartItems"" (""DishId"");
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX IF NOT EXISTS ""IX_CartItems_UserId"" ON ""CartItems"" (""UserId"");
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CartItems");
        }
    }
}
