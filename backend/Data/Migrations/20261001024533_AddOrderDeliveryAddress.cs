using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Khanara.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderDeliveryAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeliveryAddress",
                table: "Orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryZipCode",
                table: "Orders",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryAddress",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DeliveryZipCode",
                table: "Orders");
        }
    }
}
