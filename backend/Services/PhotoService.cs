using Khanara.API.Helpers;
using Khanara.API.Interfaces;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace Khanara.API.Services;

public class PhotoService : IPhotoService
{
    private readonly Cloudinary _cloudinary;

    public PhotoService(IOptions<CloudinarySettings> config)
    {
        var account = new Account(config.Value.CloudName, config.Value.ApiKey, config.Value.ApiSecret);

        _cloudinary = new Cloudinary(account);
    }
    public async Task<DeletionResult> DeletePhotoAsync(string publicId)
    {

        var deleteParams = new DeletionParams(publicId);

        return await _cloudinary.DestroyAsync(deleteParams);
    }

    private static readonly string[] AllowedContentTypes = ["image/jpeg", "image/png", "image/webp"];
    private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    public async Task<ImageUploadResult> UploadPhotoAsync(IFormFile file)
    {
        if (file.Length == 0)
            return new ImageUploadResult { Error = new Error { Message = "File is empty" } };

        if (!AllowedContentTypes.Contains(file.ContentType))
            return new ImageUploadResult { Error = new Error { Message = "Only JPEG, PNG, and WebP images are allowed" } };

        if (file.Length > MaxFileSizeBytes)
            return new ImageUploadResult { Error = new Error { Message = "File size must not exceed 5 MB" } };

        if (!HasValidImageSignature(file))
            return new ImageUploadResult { Error = new Error { Message = "File content does not match a supported image format" } };

        await using var stream = file.OpenReadStream();
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Transformation = new Transformation().Height(500).Width(500).Crop("fill").Gravity("face"),
            Folder = "da-ang20"
        };
        return await _cloudinary.UploadAsync(uploadParams);
    }

    // Reads the first 12 bytes to verify the file is actually the image type it claims to be.
    // IFormFile.ContentType comes from the HTTP request and can be spoofed by any client.
    private static bool HasValidImageSignature(IFormFile file)
    {
        Span<byte> header = stackalloc byte[12];
        using var stream = file.OpenReadStream();
        var read = stream.Read(header);

        // JPEG: FF D8 FF
        if (read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return true;

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (read >= 8 &&
            header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
            header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A)
            return true;

        // WebP: RIFF????WEBP
        if (read >= 12 &&
            header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
            header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50)
            return true;

        return false;
    }
}
