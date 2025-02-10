import { TestBed } from '@angular/core/testing';

import { AvatarsService } from './avatars.service';

describe('AvatarsService', () => {
  let service: AvatarsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AvatarsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
