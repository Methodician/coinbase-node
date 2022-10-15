import { TestBed } from '@angular/core/testing';

import { CbSocketService } from './cb-socket.service';

describe('CbSocketService', () => {
  let service: CbSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CbSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
