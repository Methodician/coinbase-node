import { Component, OnInit } from '@angular/core';
import { filter, map } from 'rxjs';
import { CbFeedService } from 'src/app/services/cb-feed.service';

@Component({
  selector: 'app-cb-feed',
  templateUrl: './cb-feed.component.html',
  styleUrls: ['./cb-feed.component.scss'],
})
export class CbFeedComponent implements OnInit {
  lastMessage$ = this.cbFeedSvc.lastMessage$;
  subscriptions$ = this.lastMessage$.pipe(
    filter((msg) => msg.type === 'subscriptions'),
    map((msg) => msg.channels)
  );
  // ticker$ = this.cbFeedSvc.ticker$;
  // l2Update$ = this.cbFeedSvc.l2Update$;
  // heartbeat$ = this.cbFeedSvc.heartbeat$;
  // snapshots = this.cbFeedSvc.snapshots;

  done$ = this.lastMessage$.pipe(filter((msg) => msg.type === 'done'));
  filled$ = this.done$.pipe(filter((msg) => msg.reason === 'filled'));
  received$ = this.lastMessage$.pipe(filter((msg) => msg.type === 'received'));
  open$ = this.lastMessage$.pipe(filter((msg) => msg.type === 'open'));
  match$ = this.lastMessage$.pipe(filter((msg) => msg.type === 'match'));

  constructor(private cbFeedSvc: CbFeedService) {}

  ngOnInit(): void {}

  types = () => Object.keys(this.cbFeedSvc.allTypes);

  // sma = () => this.cbFeedSvc.getSMA();

  currentCandle = () => this.cbFeedSvc.currentCandle;
  lastCandle = () => this.cbFeedSvc.lastCandle;
  pastCandles = () => this.cbFeedSvc.pastCandles;
}
