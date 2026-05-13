using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Khanara.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeRefundIdAndConcurrencyCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "StripeRefundId",
                table: "Orders",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StripeRefundId",
                table: "Orders");
        }
    }
}
