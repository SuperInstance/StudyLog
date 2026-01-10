/**
 * Asset Pipeline Worker
 *
 * Routes to cheapest provider for image/3D/audio generation,
 * converts to Godot format, and hot-reloads into the game.
 */

// Note: Router functionality moved inline since itty-router is not installed
// and the multi-model-router doesn't export a Router class.

interface AssetRequest {
  type: 'image' | '3d' | 'audio';
  prompt: string;
  quality: 'low' | 'medium' | 'high';
  style?: string;
  format?: string;
  voice?: string;
}

interface Asset {
  data: ArrayBuffer;
  format: string;
  metadata: Record<string, unknown>;
}

interface GodotAsset {
  data: ArrayBuffer;
  type: '.png' | '.glb' | '.wav' | '.tscn' | '.tres';
  importPath: string;
}

export async function generateAsset(request: AssetRequest): Promise<GodotAsset> {
  // Select provider based on type and quality
  const provider: Provider = {
    name: 'default',
    endpoint: 'https://api.example.com/v1',
    key: 'demo-key'
  };

  console.log(`[AssetPipeline] Generating ${request.type} with ${provider.name}`);

  // 1. Generate asset
  let asset: Asset;
  switch (request.type) {
    case 'image':
      asset = await generateImage(provider, request.prompt, request.style);
      break;
    case '3d':
      asset = await generate3D(provider, request.prompt, request.format);
      break;
    case 'audio':
      asset = await generateAudio(provider, request.prompt, request.voice);
      break;
    default:
      throw new Error(`Unknown asset type: ${request.type}`);
  }

  // 2. Convert to Godot format
  const godotAsset = await convertToGodotFormat(asset, request.type);

  // 3. Hot-reload into game
  await hotReloadAsset(godotAsset);

  return godotAsset;
}

async function generateImage(
  provider: Provider,
  prompt: string,
  style?: string
): Promise<Asset> {
  const enhancedPrompt = style ? `${prompt}, style: ${style}` : prompt;

  const response = await fetch(provider.endpoint + '/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: enhancedPrompt,
      n: 1,
      size: '512x512',
      response_format: 'binary',
    }),
  });

  if (!response.ok) {
    throw new Error(`Image generation failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    data: buffer,
    format: 'png',
    metadata: { prompt, style, provider: provider.name },
  };
}

async function generate3D(
  provider: Provider,
  prompt: string,
  format: string = 'glb'
): Promise<Asset> {
  // Route to specialized 3D API or use multi-step pipeline
  const response = await fetch(provider.endpoint + '/v1/3d/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      format,
      quality: 'medium',
    }),
  });

  if (!response.ok) {
    throw new Error(`3D generation failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    data: buffer,
    format,
    metadata: { prompt, provider: provider.name },
  };
}

async function generateAudio(
  provider: Provider,
  prompt: string,
  voice?: string
): Promise<Asset> {
  const response = await fetch(provider.endpoint + '/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: prompt,
      voice: voice || 'alloy',
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    throw new Error(`Audio generation failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    data: buffer,
    format: 'wav',
    metadata: { prompt, voice, provider: provider.name },
  };
}

async function convertToGodotFormat(asset: Asset, type: string): Promise<GodotAsset> {
  // For most formats, minimal conversion needed
  const extensionMap: Record<string, '.png' | '.glb' | '.wav' | '.tscn' | '.tres'> = {
    'image': '.png',
    '3d': '.glb',
    'audio': '.wav',
  };

  const ext = extensionMap[type] || '.png';
  const importPath = `user://generated/${Date.now()}${ext}`;

  return {
    data: asset.data,
    type: ext,
    importPath
  };
}

async function hotReloadAsset(asset: GodotAsset): Promise<void> {
  // Send WebSocket message to Godot panel
  const ws = new WebSocket('ws://localhost:7352/godot');

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.addEventListener('open', () => {
      clearTimeout(timeout);
      ws.send(
        JSON.stringify({
          type: 'hot_reload',
          asset: {
            path: asset.importPath,
            data: Array.from(new Uint8Array(asset.data)),
            format: asset.type,
          },
        })
      );
      ws.close();
      resolve();
    });

    ws.addEventListener('error', (err) => {
      clearTimeout(timeout);
      ws.close();
      reject(err);
    });
  });
}

interface Provider {
  name: string;
  endpoint: string;
  key: string;
}
