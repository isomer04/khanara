using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Khanara.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Favorites",
                columns: table => new
                {
                    EaterUserId = table.Column<string>(type: "TEXT", nullable: false),
                    CookProfileId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Favorites", x => new { x.EaterUserId, x.CookProfileId });
                    table.ForeignKey(
                        name: "FK_Favorites_AspNetUsers_EaterUserId",
                        column: x => x.EaterUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Favorites_CookProfiles_CookProfileId",
                        column: x => x.CookProfileId,
                        principalTable: "CookProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Reviews_Rating",
                table: "Reviews",
                sql: "Rating >= 1 AND Rating <= 5");

            migrationBuilder.CreateIndex(
                name: "IX_Favorites_CookProfileId",
                table: "Favorites",
                column: "CookProfileId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Favorites");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Reviews_Rating",
                table: "Reviews");
        }
    }
}
