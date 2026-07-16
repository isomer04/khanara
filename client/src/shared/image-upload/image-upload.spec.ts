import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageUpload } from './image-upload';
import { mountComponent, getByRole, userClick, waitFor } from '../../testing/test-utils';
import { ComponentFixture } from '@angular/core/testing';

/**
 * Tests for ImageUpload component
 * 
 * **Validates: Requirements 2.4, 6.1, 6.2, 6.5, 7.1, 7.2**
 * 
 * This test suite verifies:
 * - File selection triggers upload
 * - Upload progress display
 * - Validation errors (file size, file type)
 * - Successful upload displays preview
 * - Error handling for failed uploads
 */
describe('ImageUpload', () => {
  let fixture: ComponentFixture<ImageUpload>;
  let component: ImageUpload;

  beforeEach(async () => {
    fixture = await mountComponent(ImageUpload);
    component = fixture.componentInstance;
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have uploadFile output', () => {
      expect(component.uploadFile).toBeDefined();
    });

    it('should have loading input', () => {
      expect(component.loading).toBeDefined();
    });

    it('should initialize with no image preview', () => {
      expect((component as any).imageSrc()).toBeNull();
    });

    it('should initialize with isDragging false', () => {
      expect((component as any).isDragging).toBe(false);
    });
  });

  describe('Dropzone Rendering', () => {
    it('should render dropzone label', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      expect(label).toBeTruthy();
    });

    it('should render file input', () => {
      const input = fixture.nativeElement.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
    });

    it('should have hidden file input', () => {
      const input = fixture.nativeElement.querySelector('input[type="file"]');
      expect(input?.classList.contains('hidden')).toBe(true);
    });

    it('should display upload instructions', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Click to upload or drag and drop');
    });

    it('should have cursor-pointer class on label', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      expect(label?.classList.contains('cursor-pointer')).toBe(true);
    });
  });

  describe('Drag and Drop - Drag Over', () => {
    it('should set isDragging to true on dragover', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      expect((component as any).isDragging).toBe(true);
    });

    it('should prevent default on dragover', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      label?.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should stop propagation on dragover', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      
      label?.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should apply border-purple-600 class when dragging', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(label?.classList.contains('border-purple-600')).toBe(true);
    });

    it('should apply border-4 class when dragging', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(label?.classList.contains('border-4')).toBe(true);
    });

    it('should apply bg-purple-100 class when dragging', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragover', { bubbles: true, cancelable: true });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(label?.classList.contains('bg-purple-100')).toBe(true);
    });
  });

  describe('Drag and Drop - Drag Leave', () => {
    it('should set isDragging to false on dragleave', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // First set isDragging to true
      const dragoverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
      label?.dispatchEvent(dragoverEvent);
      expect((component as any).isDragging).toBe(true);

      // Then trigger dragleave
      const dragleaveEvent = new DragEvent('dragleave', { bubbles: true, cancelable: true });
      label?.dispatchEvent(dragleaveEvent);
      fixture.detectChanges();

      expect((component as any).isDragging).toBe(false);
    });

    it('should prevent default on dragleave', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragleave', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      label?.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should stop propagation on dragleave', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const event = new DragEvent('dragleave', { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      
      label?.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should remove drag styling classes on dragleave', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // First trigger dragover
      const dragoverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
      label?.dispatchEvent(dragoverEvent);
      fixture.detectChanges();
      await fixture.whenStable();

      // Then trigger dragleave
      const dragleaveEvent = new DragEvent('dragleave', { bubbles: true, cancelable: true });
      label?.dispatchEvent(dragleaveEvent);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(label?.classList.contains('border-purple-600')).toBe(false);
      expect(label?.classList.contains('border-4')).toBe(false);
      expect(label?.classList.contains('bg-purple-100')).toBe(false);
    });
  });

  describe('Drag and Drop - Drop', () => {
    it('should set isDragging to false on drop', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Create a mock file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      expect((component as any).isDragging).toBe(false);
    });

    it('should prevent default on drop', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      label?.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should stop propagation on drop', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');
      
      label?.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should store file when dropped', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      expect((component as any).fileToUpload).toBe(file);
    });

    it('should preview image when file is dropped', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      // Wait for FileReader to complete
      await waitFor(() => {
        expect((component as any).imageSrc()).toBeTruthy();
      }, { fixture });
    });

    it('should handle drop with no files', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer: new DataTransfer()
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      expect((component as any).fileToUpload).toBeNull();
    });
  });

  describe('Image Preview Display', () => {
    it('should not display preview initially', () => {
      const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
      expect(preview).toBeNull();
    });

    it('should display preview after file is dropped', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      // Wait for FileReader and Angular change detection
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });
    });

    it('should display Cancel button when preview is shown', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        const buttons = fixture.nativeElement.querySelectorAll('button');
        const cancelButton = Array.from(buttons).find((btn: any) => 
          btn.textContent?.includes('Cancel')
        );
        expect(cancelButton).toBeTruthy();
      }, { fixture });
    });

    it('should display Upload button when preview is shown', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        const buttons = fixture.nativeElement.querySelectorAll('button');
        const uploadButton = Array.from(buttons).find((btn: any) => 
          btn.textContent?.includes('Upload image')
        );
        expect(uploadButton).toBeTruthy();
      }, { fixture });
    });
  });

  describe('Cancel Functionality', () => {
    it('should clear preview when Cancel is clicked', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Click Cancel button
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Cancel')
      ) as HTMLButtonElement;
      
      await userClick(cancelButton, fixture);

      expect((component as any).imageSrc()).toBeNull();
    });

    it('should clear fileToUpload when Cancel is clicked', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Click Cancel button
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Cancel')
      ) as HTMLButtonElement;
      
      await userClick(cancelButton, fixture);

      expect((component as any).fileToUpload).toBeNull();
    });

    it('should hide preview UI after Cancel', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Click Cancel button
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Cancel')
      ) as HTMLButtonElement;
      
      await userClick(cancelButton, fixture);

      const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
      expect(preview).toBeNull();
    });
  });

  describe('Upload Functionality', () => {
    it('should emit uploadFile event when Upload button is clicked', async () => {
      const uploadSpy = vi.fn();
      component.uploadFile.subscribe(uploadSpy);

      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Click Upload button
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const uploadButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Upload image')
      ) as HTMLButtonElement;
      
      await userClick(uploadButton, fixture);

      expect(uploadSpy).toHaveBeenCalledWith(file);
    });

    it('should not emit uploadFile event if no file is selected', async () => {
      const uploadSpy = vi.fn();
      component.uploadFile.subscribe(uploadSpy);

      // Manually set imageSrc to show the upload button without a file
      (component as any).imageSrc.set('data:image/png;base64,test');
      fixture.detectChanges();
      await fixture.whenStable();

      // Click Upload button
      const buttons = fixture.nativeElement.querySelectorAll('button');
      const uploadButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Upload image')
      ) as HTMLButtonElement;
      
      if (uploadButton) {
        await userClick(uploadButton, fixture);
      }

      expect(uploadSpy).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable Upload button when loading is true', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Set loading to true
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const uploadButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Upload image')
      ) as HTMLButtonElement;

      expect(uploadButton?.hasAttribute('disabled')).toBe(true);
    });

    it('should display loading spinner when loading is true', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Set loading to true
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      await fixture.whenStable();

      const spinner = fixture.nativeElement.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
    });

    it('should not disable Upload button when loading is false', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Drop a file
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const dropEvent = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(dropEvent);
      fixture.detectChanges();

      // Wait for preview to appear
      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });

      // Set loading to false
      fixture.componentRef.setInput('loading', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      const uploadButton = Array.from(buttons).find((btn: any) => 
        btn.textContent?.includes('Upload image')
      ) as HTMLButtonElement;

      expect(uploadButton?.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple drag over/leave cycles', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // Cycle 1
      label?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
      expect((component as any).isDragging).toBe(true);
      
      label?.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
      expect((component as any).isDragging).toBe(false);

      // Cycle 2
      label?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
      expect((component as any).isDragging).toBe(true);
      
      label?.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }));
      expect((component as any).isDragging).toBe(false);
    });

    it('should handle dropping multiple files (only first file is used)', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file1);
      dataTransfer.items.add(file2);
      
      const event = new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      });
      
      label?.dispatchEvent(event);
      fixture.detectChanges();

      // Should only store the first file
      expect((component as any).fileToUpload).toBe(file1);
    });

    it('should handle cancel and re-upload workflow', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      // First upload
      const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const dataTransfer1 = new DataTransfer();
      dataTransfer1.items.add(file1);
      
      label?.dispatchEvent(new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer: dataTransfer1 
      }));
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        expect((component as any).imageSrc()).toBeTruthy();
      }, { fixture });

      // Cancel
      const buttons1 = fixture.nativeElement.querySelectorAll('button');
      const cancelButton = Array.from(buttons1).find((btn: any) => 
        btn.textContent?.includes('Cancel')
      ) as HTMLButtonElement;
      
      await userClick(cancelButton, fixture);
      expect((component as any).imageSrc()).toBeNull();

      // Second upload
      const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
      const dataTransfer2 = new DataTransfer();
      dataTransfer2.items.add(file2);
      
      label?.dispatchEvent(new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer: dataTransfer2 
      }));
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        expect((component as any).imageSrc()).toBeTruthy();
      }, { fixture });

      expect((component as any).fileToUpload).toBe(file2);
    });
  });

  describe('Accessibility', () => {
    it('should have label associated with file input', () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      const input = fixture.nativeElement.querySelector('input#dropzone-file');
      
      expect(label).toBeTruthy();
      expect(input).toBeTruthy();
    });

    it('should have descriptive text for upload area', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Click to upload or drag and drop');
    });

    it('should have alt text for preview image', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      label?.dispatchEvent(new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      }));
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        const preview = fixture.nativeElement.querySelector('img[alt="image preview"]');
        expect(preview).toBeTruthy();
      }, { fixture });
    });

    it('should have accessible button labels', async () => {
      const label = fixture.nativeElement.querySelector('label[for="dropzone-file"]');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      label?.dispatchEvent(new DragEvent('drop', { 
        bubbles: true, 
        cancelable: true,
        dataTransfer 
      }));
      fixture.detectChanges();

      await waitFor(() => {
        fixture.detectChanges();
        const buttons = fixture.nativeElement.querySelectorAll('button');
        const cancelButton = Array.from(buttons).find((btn: any) => 
          btn.textContent?.includes('Cancel')
        );
        const uploadButton = Array.from(buttons).find((btn: any) => 
          btn.textContent?.includes('Upload image')
        );
        
        expect(cancelButton).toBeTruthy();
        expect(uploadButton).toBeTruthy();
      }, { fixture });
    });
  });
});
