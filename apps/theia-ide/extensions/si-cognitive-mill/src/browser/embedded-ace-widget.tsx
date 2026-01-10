@injectable()
export class EmbeddedACEWidget extends ReactWidget {
  static readonly ID = 'si.embedded-ace';
  static readonly LABEL = 'Embedded ACE Thoughts';

  protected aceSession: ACESession | undefined;

  @postConstruct()
  protected init(): void {
    this.id = EmbeddedACEWidget.ID;
    this.title.label = EmbeddedACEWidget.LABEL;
  }

  // Called when student selects a simulated Jetson
  async attachToJetson(jetsonId: string, persona: Persona): Promise<void> {
    const jetson = await this.jetsonService.getSimulated(jetsonId);
    
    this.aceSession = await this.aceService.createEmbeddedSession({
      model: 'nvidia/ace-jetson-reasoning-4b',
      persona: PERSONA_TEMPLATES[persona],
      constraints: {
        memory_mb: jetson.memoryMB,
        inference_ms_max: 200,
        devices: jetson.connectedDevices
      }
    });

    // Subscribe to ACE's thoughts
    this.aceSession.onThought((thought) => {
      this.thoughtLog.push(thought);
      this.update();
    });
  }

  protected render(): React.ReactNode {
    if (!this.aceSession) {
      return <div>Select a simulated Jetson to see ACE's thoughts</div>;
    }

    return (
      <div className="si-embedded-ace">
        <ACEThoughtStream thoughts={this.thoughtLog} />
        <ACEInterrogationPane 
          session={this.aceSession}
          onQuestion={(q) => this.aceSession?.explain(q)}
        />
      </div>
    );
  }
}