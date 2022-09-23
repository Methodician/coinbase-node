import { TestBed } from '@angular/core/testing';

import { CbFeedService } from './cb-feed.service';

describe('CbFeedService', () => {
  let service: CbFeedService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CbFeedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
