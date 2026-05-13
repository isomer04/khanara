import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export type MemberProfile = {
  id: string;
  displayName: string;
  imageUrl?: string;
  email: string;
};

export type UpdateMemberDto = {
  displayName: string;
};

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  member = signal<MemberProfile | null>(null);

  getMember(id: string) {
    return this.http.get<MemberProfile>(this.baseUrl + 'members/' + id).pipe(
      tap(member => this.member.set(member))
    );
  }

  updateMember(dto: UpdateMemberDto) {
    return this.http.put<MemberProfile>(this.baseUrl + 'members', dto).pipe(
      tap(updated => this.member.set(updated))
    );
  }

  uploadPhoto(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MemberProfile>(this.baseUrl + 'members/add-photo', formData).pipe(
      tap(updated => this.member.set(updated))
    );
  }
}