using CloudinaryDotNet.Actions;
using Khanara.API.Interfaces;
using Microsoft.AspNetCore.Http;

namespace Khanara.API.Tests.Mocks;

public class MockPhotoService : IPhotoService
{
    private readonly Dictionary<string, string> _uploadedPhotos = new();

    public Task<ImageUploadResult> UploadPhotoAsync(IFormFile file)
    {
        var publicId = $"test_{Guid.NewGuid()}";
        var url = $"https://res.cloudinary.com/test/image/upload/{publicId}";

        _uploadedPhotos[publicId] = file.FileName;

        return Task.FromResult(new ImageUploadResult
        {
            PublicId = publicId,
            SecureUrl = new Uri(url),
            Error = null
        });
    }

    public Task<DeletionResult> DeletePhotoAsync(string publicId)
    {
        _uploadedPhotos.Remove(publicId);

        return Task.FromResult(new DeletionResult
        {
            Result = "ok"
        });
    }

    public IReadOnlyDictionary<string, string> GetUploadedPhotos() => _uploadedPhotos;
}
