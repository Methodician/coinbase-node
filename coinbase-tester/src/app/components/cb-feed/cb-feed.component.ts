import { Component, OnInit } from '@angular/core';
import { from, map, switchMap } from 'rxjs';
import { CbFeedService, MergedTrade } from 'src/app/services/cb-feed.service';

@Component({
  selector: 'app-cb-feed',
  templateUrl: './cb-feed.component.html',
  styleUrls: ['./cb-feed.component.scss'],
})
export class CbFeedComponent implements OnInit {
  socketTrades: MergedTrade[] = [];

  ethMerge$ = from(this.cbFeedSvc.getMergedMatches('ETH-USD', 220));

  constructor(private cbFeedSvc: CbFeedService) {
    this.ethMerge$
      .pipe(switchMap((merge) => merge.socket.lastMessage$))
      .subscribe((msg) => {
        this.socketTrades.push(this.cbFeedSvc.processTrade(msg, 'ETH-USD'));
      });
  }

  ngOnInit(): void {}

  // temp
  restIntersectionCount$ = this.ethMerge$.pipe(
    map((merge) =>
      merge.restTrades.reduce((acc, trade) => {
        if (merge.intersectionIds.includes(trade.tradeId)) {
          acc++;
        }
        return acc;
      }, 0)
    )
  );

  activeSocketIntersectionCount$ = this.ethMerge$.pipe(
    map((merge) =>
      this.socketTrades.reduce((acc, trade) => {
        if (
          merge.socketTrades
            .map((trade) => trade.tradeId)
            .includes(trade.tradeId)
        ) {
          acc++;
        }
        return acc;
      }, 0)
    )
  );
  socketIntersectionCount$ = this.ethMerge$.pipe(
    map((merge) =>
      merge.socketTrades.reduce((acc, trade) => {
        if (merge.intersectionIds.includes(trade.tradeId)) {
          acc++;
        }
        return acc;
      }, 0)
    )
  );
}
