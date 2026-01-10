/**
 * Godot Process Manager
 *
 * Downloads and manages Godot 4.3 headless process.
 * Handles startup, shutdown, and health monitoring.
 */

import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

const GODOT_VERSION = '4.3';
const GODOT_PORT = 7352;

@injectable()
export class GodotProcessManager {
  private process: ChildProcess | null = null;
  private godotPath: string;
  private projectPath: string;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const siDir = path.join(homeDir, '.superinstance');
    this.godotPath = path.join(siDir, `godot-${GODOT_VERSION}`, 'bin', 'godot_headless');
    this.projectPath = path.join(siDir, 'godot-project');
  }

  async initialize(): Promise<void> {
    // Ensure directories exist
    await this.ensureGodotInstalled();
    await this.ensureProjectExists();
  }

  async isRunning(): Promise<boolean> {
    if (!this.process) {
      return false;
    }

    // Check if process is alive
    try {
      process.kill(this.process.pid, 0);
      return true;
    } catch {
      this.process = null;
      return false;
    }
  }

  async start(): Promise<void> {
    if (await this.isRunning()) {
      console.log('[GodotPM] Already running');
      return;
    }

    await this.initialize();

    return new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--path',
        this.projectPath,
        '--websocket',
        `--websocket-port=${GODOT_PORT}`,
      ];

      console.log('[GodotPM] Starting:', this.godotPath, args.join(' '));

      this.process = spawn(this.godotPath, args, {
        env: {
          ...process.env,
          GODOT_WS_PORT: String(GODOT_PORT),
        },
      });

      this.process.stdout?.on('data', (data) => {
        console.log('[Godot]', data.toString().trim());
      });

      this.process.stderr?.on('data', (data) => {
        console.error('[Godot Error]', data.toString().trim());
      });

      this.process.on('error', (err) => {
        console.error('[GodotPM] Process error:', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        console.log(`[GodotPM] Exited with code ${code}`);
        this.process = null;
      });

      // Wait for server to be ready
      this.waitForServer(GODOT_PORT)
        .then(() => resolve())
        .catch(reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('[GodotPM] Stopping...');
    this.process.kill('SIGTERM');

    // Wait up to 5 seconds for graceful shutdown
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!this.process) {
        return;
      }
    }

    // Force kill if still running
    this.process.kill('SIGKILL');
    this.process = null;
  }

  getPort(): number {
    return GODOT_PORT;
  }

  async getVersion(): Promise<string> {
    return GODOT_VERSION;
  }

  private async ensureGodotInstalled(): Promise<void> {
    if (fs.existsSync(this.godotPath)) {
      console.log('[GodotPM] Godot already installed at:', this.godotPath);
      return;
    }

    console.log('[GodotPM] Downloading Godot...', GODOT_VERSION);
    await this.downloadGodot();
  }

  private async downloadGodot(): Promise<void> {
    const platform = process.platform;
    let arch = process.arch;
    if (arch === 'x64') arch = 'amd64';
    if (arch === 'arm64') arch = 'arm64';

    const filename = `Godot_v${GODOT_VERSION}-${platform}_${arch}`;
    const ext = platform === 'win32' ? 'zip' : 'tar.xz';
    const url = `https://downloads.tuxfamily.org/godotengine/${GODOT_VERSION}/${filename}.${ext}`;

    console.log('[GodotPM] Downloading from:', url);
    // Implementation would download and extract to godotPath
    console.log('[GodotPM] Manual download required. Please install Godot', GODOT_VERSION);
  }

  private async ensureProjectExists(): Promise<void> {
    if (!fs.existsSync(this.projectPath)) {
      await mkdir(this.projectPath, { recursive: true });
      await this.createMinimalProject();
    }
  }

  private async createMinimalProject(): Promise<void> {
    // Create minimal Godot project structure
    const projectFile = path.join(this.projectPath, 'project.godot');

    const projectConfig = {
      'config/features': 'PackedStringArray("4.3")',
      'config/icon': 'res://icon.svg',
      'application/run/main_scene': 'res://main.tscn',
      'application/config/name': 'SuperInstance.AI',
    };

    let content = '; Engine configuration file.\n';
    content += '; It\'s best edited using the editor UI and not directly,\n';
    content += '; since the parameters that go here are not all obvious.\n';
    content += ';\n';
    content += '; Format:\n';
    content += ';   [section] ; section goes between []\n';
    content += ';   param=value ; assign values to parameters\n\n';

    for (const [key, value] of Object.entries(projectConfig)) {
      const [section, ...rest] = key.split('/');
      const param = rest.join('/');
      content += `\n[${section}]\n${param}="${value}"\n`;
    }

    await fs.promises.writeFile(projectFile, content);

    // Create main scene with WebSocket support
    const mainScene = path.join(this.projectPath, 'main.tscn');
    const sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://main"]

[ext_resource type="Script" path="res://main.gd" id="1_XXXXX"]

[node name="Main" type="Node"]
script = ExtResource("1_XXXXX")

[node name="WebSocketServer" type="WebSocketServer" parent="."]
listen_port = ${GODOT_PORT}
`;

    await fs.promises.writeFile(mainScene, sceneContent);

    // Create GDScript for WebSocket handling
    const mainScript = path.join(this.projectPath, 'main.gd');
    const scriptContent = `extends Node

var ws = null
var agents = {}

func _ready():
	ws = $WebSocketServer
	ws.client_connected.connect(_on_client_connected)
	ws.data_received.connect(_on_data_received)
	print("SuperInstance.AI Godot Server Ready on port ${GODOT_PORT}")

func _on_client_connected(id):
	print("Client connected: ", id)
	_send_stats()

func _on_data_received(id, data):
	var parsed = JSON.parse_string(data.get_string_from_utf8())
	if not parsed:
		return

	var msg_type = parsed.get("type")
	var msg_data = parsed.get("data")

	match msg_type:
		"hot_reload":
			_handle_hot_reload(msg_data)
		"agent_update":
			_handle_agent_update(msg_data)
		"command":
			_handle_command(msg_data)

func _handle_hot_reload(data):
	print("Hot reload: ", data)

func _handle_agent_update(data):
	var agent_id = data.get("id")
	var position = data.get("position")
	if agent_id and position:
		agents[agent_id] = position
		_update_agent_scene(agent_id, position)

func _handle_command(data):
	var command = data.get("command")
	var args = data.get("args")
	print("Command: ", command, args)

func _update_agent_scene(agent_id, position):
	# Update or create agent node in scene
	pass

func _send_stats():
	var stats = {
		"type": "stats",
		"fps": Engine.get_frames_per_second(),
		"agents": agents.size()
	}
	_broadcast(JSON.stringify(stats))

func _broadcast(data):
	ws.peek().put_packet(data.to_utf8_buffer())
`;

    await fs.promises.writeFile(mainScript, scriptContent);

    console.log('[GodotPM] Project created at:', this.projectPath);
  }

  private async waitForServer(port: number, timeout = 10000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        await new Promise<void>((resolve, reject) => {
          const req = http.get(`http://localhost:${port}`, () => resolve());
          req.on('error', reject);
          req.setTimeout(100, () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });
        console.log('[GodotPM] Server is ready');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    throw new Error('Server not ready after timeout');
  }
}
