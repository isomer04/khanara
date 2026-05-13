// Disable parallel test execution across all collections.
// All integration tests share a single in-memory SQLite database via IClassFixture,
// so running tests in parallel causes duplicate-user and stale-data failures.
[assembly: Xunit.CollectionBehavior(DisableTestParallelization = true, MaxParallelThreads = 1)]
