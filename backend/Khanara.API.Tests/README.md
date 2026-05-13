# Khanara API Test Suite

## Overview

This test suite provides comprehensive integration testing for the Khanara API using xUnit, WebApplicationFactory, and Moq. The tests cover all major controllers and business logic with a focus on happy paths, edge cases, and error scenarios.

## Test Infrastructure

### Core Components

- **CustomWebApplicationFactory**: Configures in-memory SQLite database and mock services
- **BaseIntegrationTest**: Base class providing common test utilities and helpers
- **AuthenticationHelper**: Simplifies user creation and JWT token generation
- **Test Data Builders**: Fluent builders for creating test entities (User, Dish, Order, CookProfile)
- **Mock Services**: MockStripeService and MockPhotoService for external dependencies
- **Assertion Extensions**: Custom FluentAssertions extensions for HTTP responses, JWT tokens, and database state

### Configuration Files

- `appsettings.Test.json`: Test-specific configuration
- `xunit.runner.json`: Parallel execution configuration
- `coverlet.runsettings`: Code coverage settings

## Test Coverage

### Controller Tests (120+ tests)

#### AccountController (10 tests)
- User registration with validation
- Login with credentials and lockout
- JWT token generation and validation
- Refresh token management
- Logout and token invalidation
- Authorization checks

#### CartController (18 tests)
- Add items to cart (new and existing)
- Update cart item quantities
- Remove items and clear cart
- Cart merging (guest to authenticated)
- Quantity validation (max 100)
- Availability checks
- Concurrency handling

#### OrdersController (24 tests)
- Order placement with validation
- Portion management and decrement
- Order status transitions
- Order cancellation with portion restoration
- Authorization (eater/cook access)
- Pagination
- Multi-item orders with total calculation

#### PaymentsController (14 tests)
- Stripe checkout session creation
- Webhook processing (checkout.session.completed, charge.refunded)
- Webhook signature verification
- Idempotency (duplicate event handling)
- Refund processing
- Authorization and validation

#### DishesController (15 tests)
- CRUD operations (create, read, update, delete)
- Photo upload and management
- Authorization (cook-only operations)
- Filtering and pagination
- Portion validation

#### CooksController (10 tests)
- Cook profile creation with role assignment
- Profile updates
- Profile retrieval with dishes
- Filtering by cuisine tags
- Review pagination
- Authorization checks

#### ReviewsController (9 tests)
- Review submission for delivered orders
- Rating calculation (atomic updates)
- Cook replies to reviews
- Duplicate review prevention
- Authorization checks

#### FavoritesController (6 tests)
- Add/remove favorites
- Idempotent favorite addition
- Own kitchen validation
- Pagination
- Favorite IDs retrieval

#### DiscoveryController (4 tests)
- Near me search by zip code
- Popular cooks retrieval
- New cooks retrieval
- Zip code validation

#### AdminController (3 tests)
- User list with roles
- Role editing
- Admin-only authorization

## Running Tests

### Run All Tests
```bash
dotnet test Khanara.API.Tests/Khanara.API.Tests.csproj
```

### Run Specific Test Class
```bash
dotnet test --filter "FullyQualifiedName~AccountControllerTests"
```

### Run with Code Coverage
```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura
```

## Test Patterns

### AAA Pattern
All tests follow the Arrange-Act-Assert pattern:
```csharp
[Fact]
public async Task TestName_Scenario_ExpectedBehavior()
{
    // Arrange
    var user = await AuthHelper.CreateUserAsync(...);
    
    // Act
    var response = await client.PostAsJsonAsync(...);
    
    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);
}
```

### Test Data Builders
```csharp
var dish = new DishBuilder()
    .WithName("Test Dish")
    .WithPrice(15.99m)
    .ForCook(profileId)
    .Build();
```

### Authentication Helper
```csharp
var client = await CreateAuthenticatedClient(
    "user@test.com", 
    "Password123!@#", 
    "Cook");
```

### Assertion Extensions
```csharp
response.ShouldBeSuccessWithContent<OrderDto>();
response.ShouldBeBadRequest();
response.ShouldBeUnauthorized();
token.ShouldBeValidJwtToken("user@test.com");
```

## Database Management

### In-Memory SQLite
- Each test class gets a fresh database via `IClassFixture<CustomWebApplicationFactory>`
- Connection persists for the lifetime of the factory
- `EnsureCreated()` initializes schema from EF Core model
- Roles are seeded automatically

### Test Isolation
- Tests within a class share the same database
- Use unique email addresses for each test to avoid conflicts
- Database is disposed after all tests in a class complete

## Mock Services

### Stripe Service
```csharp
Factory.MockStripeService
    .Setup(s => s.CreateCheckoutSessionAsync(It.IsAny<Order>()))
    .ReturnsAsync(("session_id", "https://checkout.url"));
```

### Photo Service
```csharp
Factory.MockPhotoService
    .Setup(s => s.UploadPhotoAsync(It.IsAny<IFormFile>()))
    .ReturnsAsync(new ImageUploadResult { ... });
```

## Best Practices

1. **Test Naming**: `MethodName_Scenario_ExpectedBehavior`
2. **One Assert Per Test**: Focus on a single behavior
3. **Arrange Helpers**: Use builders and helpers for test data
4. **Verify Database State**: Check both HTTP response and database
5. **Test Authorization**: Verify Forbidden/Unauthorized responses
6. **Test Validation**: Cover edge cases and invalid inputs
7. **Mock External Services**: Never call real Stripe/Cloudinary APIs

## Troubleshooting

### Database Initialization Issues
If you see "no such table" errors:
- Ensure `CustomWebApplicationFactory` properly initializes the database in `CreateHost`
- Check that the SQLite connection remains open
- Verify `EnsureCreated()` is called before tests run

### Authentication Issues
- Ensure roles are seeded in `CustomWebApplicationFactory`
- Check JWT token configuration in `appsettings.Test.json`
- Verify `AuthenticationHelper` is using the correct `ITokenService`

### Test Isolation Issues
- Use unique email addresses for each test
- Clear any shared state between tests
- Consider using `[Collection("Sequential")]` for tests that can't run in parallel

## Future Enhancements

### Additional Test Coverage
- SignalR hub unit tests
- Concurrency and race condition tests
- Repository unit tests
- Background service tests
- Error handling and logging tests

### CI/CD Integration
- GitHub Actions workflow for automated testing
- Code coverage reporting with Codecov
- Coverage threshold enforcement (80%)
- Test result publishing

### Performance Testing
- Load testing for high-traffic endpoints
- Concurrency testing for cart and order operations
- Database query performance profiling

## Contributing

When adding new tests:
1. Follow existing patterns and naming conventions
2. Use test data builders for entity creation
3. Add assertion extensions for common checks
4. Document any new test infrastructure
5. Ensure tests are isolated and repeatable
6. Aim for meaningful coverage, not vanity metrics

## Test Statistics

- **Total Tests**: 120+
- **Controller Coverage**: 10/12 controllers (83%)
- **Test Execution Time**: < 30 seconds
- **Code Coverage Target**: 80%

## Contact

For questions or issues with the test suite, please contact the development team.
