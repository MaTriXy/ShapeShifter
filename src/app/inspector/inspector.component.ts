import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { PathLayer } from '../scripts/layers';
import { PathCommand } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { InspectorService, EventType, InspectorEvent } from './inspector.service';
import { AutoAwesome } from '../scripts/common';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
  providers: [InspectorService]
})
export class InspectorComponent implements OnInit, OnDestroy {
  @Input() canvasType: CanvasType;

  // Path commands to use to populate the ngFor loop of path components.
  pathIds: ReadonlyArray<string> = [];
  pathCommands: ReadonlyArray<PathCommand> = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private inspectorService: InspectorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.canvasType, vl => {
          if (!vl) {
            return;
          }
          const pathIds: string[] = [];
          const pathCommands: PathCommand[] = [];
          vl.walk(layer => {
            if (!(layer instanceof PathLayer)) {
              return;
            }
            pathIds.push(layer.id);
            pathCommands.push(layer.pathData);
          });
          this.pathIds = pathIds;
          this.pathCommands = pathCommands;
        }));
    this.subscriptions.push(
      this.inspectorService.addListener((event: InspectorEvent) => {
        const {eventType, pathId, subIdx, cmdIdx} = event;
        const vl = this.layerStateService.getLayer(this.canvasType);
        const pathLayer = vl.findLayerById(pathId) as PathLayer;
        switch (eventType) {
          case EventType.AutoFix: {
            const targetCanvasType =
              this.canvasType === CanvasType.End
                ? CanvasType.Start
                : CanvasType.End;
            const targetVl = this.layerStateService.getLayer(targetCanvasType);
            const fromPathLayer = pathLayer;
            const toPathLayer = targetVl.findLayerById(pathId) as PathLayer;
            const autoFixResult = AutoAwesome.fixAll(subIdx, fromPathLayer.pathData, toPathLayer.pathData);
            fromPathLayer.pathData = autoFixResult.from;
            toPathLayer.pathData = autoFixResult.to;
            this.layerStateService.notifyChange(CanvasType.Start);
            this.layerStateService.notifyChange(CanvasType.End);
            // TODO: update selections
          }
            break;
          case EventType.Convert: {
            const targetCanvasType =
              this.canvasType === CanvasType.End
                ? CanvasType.Start
                : CanvasType.End;
            const targetVl = this.layerStateService.getLayer(targetCanvasType);
            const targetPathData = (targetVl.findLayerById(pathId) as PathLayer).pathData;
            const targetSvgChar =
              targetPathData.subPathCommands[subIdx].commands[cmdIdx].svgChar;
            if (targetPathData) {
              pathLayer.pathData =
                pathLayer.pathData.convert(subIdx, cmdIdx, targetSvgChar);
              // TODO: update selections
            }
          }
            break;
          case EventType.Reverse:
            pathLayer.pathData = pathLayer.pathData.reverse(subIdx);
            const numCommands = pathLayer.pathData.subPathCommands[subIdx].commands.length;
            // TODO: update selections
            break;
          case EventType.ShiftBack:
            pathLayer.pathData = pathLayer.pathData.shiftBack(subIdx);
            // TODO: update selections
            break;
          case EventType.ShiftForward:
            pathLayer.pathData = pathLayer.pathData.shiftForward(subIdx);
            // TODO: update selections
            break;
          case EventType.Split:
            pathLayer.pathData = pathLayer.pathData.splitInHalf(subIdx, cmdIdx);
            // TODO: update selections
            break;
          case EventType.Unsplit:
            pathLayer.pathData = pathLayer.pathData.unsplit(subIdx, cmdIdx);
            // TODO: update selections
            break;
        }
        this.layerStateService.notifyChange(this.canvasType);
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  trackPathCommand(index: number, item: PathCommand) {
    // TODO: will need to change this once we support reordering paths
    return index;
  }
}
