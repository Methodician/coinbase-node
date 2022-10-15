import { TestBed } from '@angular/core/testing';

import { CbRestService } from './cb-rest.service';

describe('CbRestService', () => {
  let service: CbRestService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CbRestService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
