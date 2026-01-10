import * as React from 'react';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core/lib/common/message-service';
import { ComponentPalette } from './palette-widget';
import { Workbench } from './workbench-widget';
import { SimAVRService } from '../common/simavr-service';
import { ProjectExportService } from '../common/export-service';

@injectable()
export class SuperInstanceSimulatorWidget extends ReactWidget {
  static readonly ID = 'superinstance.simulator';
  static readonly LABEL = 'Mill Simulator';

  @inject(MessageService) protected readonly messageService: MessageService;
  @inject(SimAVRService) protected readonly simavr: SimAVRService;
  @inject(ProjectExportService) protected readonly exporter: ProjectExportService;

  protected components: ComponentInstance[] = [];
  protected wires: Wire[] = [];

  @postConstruct()
  protected init(): void {
    this.id = SuperInstanceSimulatorWidget.ID;
    this.title.label = SuperInstanceSimulatorWidget.LABEL;
    this.title.caption = 'Build and test circuits';
    this.title.closable = true;
    this.update();
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-simulator-container">
        <div className="si-simulator-header">
          <h2>⚙️ Circuit Mill</h2>
          <button 
            className="si-button-primary"
            onClick={this.handlePlay}
          >
            ▶️ Play
          </button>
          <button 
            className="si-button-secondary"
            onClick={this.handleExport}
          >
            📦 Export
          </button>
        </div>
        
        <div className="si-simulator-body">
          <ComponentPalette onDrop={this.handleAddComponent} />
          <Workbench 
            components={this.components}
            wires={this.wires}
            onWire={this.handleWire}
            onMove={this.handleMoveComponent}
          />
        </div>

        <div className="si-simulator-status">
          <span>Components: {this.components.length}</span>
          <span>Wires: {this.wires.length}</span>
        </div>
      </div>
    );
  }

  protected handleAddComponent = (type: ComponentType) => {
    const instance: ComponentInstance = {
      id: `comp_${Date.now()}`,
      type,
      position: { x: 100, y: 100 },
      rotation: 0
    };
    this.components.push(instance);
    this.update();
  };

  protected handleWire = (from: PinId, to: PinId) => {
    this.wires.push({ from, to });
    this.update();
  };

  protected handleMoveComponent = (id: string, position: Point) => {
    const comp = this.components.find(c => c.id === id);
    if (comp) comp.position = position;
    this.update();
  };

  protected handlePlay = async () => {
    try {
      this.messageService.info('Running simulation...');
      const hex = await this.compileToAVR(this.components, this.wires);
      const result = await this.simavr.run(hex, { cycles: 1_000_000 });
      this.visualize(result);
      this.messageService.info('✅ Simulation complete!');
    } catch (e) {
      this.messageService.error(`💥 Simulation failed: ${e.message}`);
    }
  };

  protected handleExport = async () => {
    const capabilities = await this.getCapabilityToken();
    if (!capabilities.can_export_firmware) {
      this.messageService.warn('Export requires 3 solved puzzles. Keep learning!');
      return;
    }

    try {
      const zip = await this.exporter.generateZip(this.components, this.wires);
      const blob = new Blob([zip], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mill-project.zip';
      a.click();
      this.messageService.info('📦 Project exported!');
    } catch (e) {
      this.messageService.error(`Export failed: ${e.message}`);
    }
  };

  protected async getCapabilityToken(): Promise<CapabilityToken> {
    const response = await fetch('/api/capabilities', {
      headers: { 'X-Student-ID': this.getStudentId() }
    });
    return response.json();
  }

  protected getStudentId(): string {
    return localStorage.getItem('si.student.id') || 'anonymous';
  }

  protected visualize(result: SimResult) {
    // Update the WebGL canvas based on simulation output
    this.update();
  }

  protected async compileToAVR(components: ComponentInstance[], wires: Wire[]): Promise<Uint8Array> {
    // Convert visual circuit to Arduino C++ → compile to HEX
    return new Uint8Array();
  }
}