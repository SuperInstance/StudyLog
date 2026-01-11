# Luanti Deep Dive: Architecture and Integration Guide

**For SuperInstance.AI StudyLoG.AI and DMLoG.AI Integration**

**Date:** 2026-01-10
**Research Target:** Luanti (formerly Minetest) v5.15.0
**Repository:** https://github.com/luanti-org/luanti
**Analysis By:** SuperInstance.AI Research Team

---

## Executive Summary

Luanti is a free open-source voxel game engine with easy modding and game creation. It provides:
- **C++ core engine** (~115K lines of code) handling rendering, networking, physics
- **Lua modding API** for game logic and content definition
- **Server-client architecture** with multiplayer support
- **Modular world generation** via pluggable mapgens
- **SQLite/LevelDB/Redis/PostgreSQL** backend support for world storage

**Key Integration Opportunities for SuperInstance.AI:**
1. Custom mapgen for educational/dungeon worlds
2. AI agent entities via LuaEntitySAO
3. Network bridge to our backend services
4. Asset generation pipeline integration
5. Student progress tracking via mod storage

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Engine Architecture](#core-engine-architecture)
3. [World Storage Format](#world-storage-format)
4. [Network Protocol](#network-protocol)
5. [Map Generation System](#map-generation-system)
6. [Mod Loading System](#mod-loading-system)
7. [Lua API Reference](#lua-api-reference)
8. [Active Objects & Entities](#active-objects--entities)
9. [Database Backends](#database-backends)
10. [Integration Points](#integration-points)
11. [StudyLoG.AI Integration](#studylogai-integration)
12. [DMLoG.AI Integration](#dmlogai-integration)
13. [Electronics Theme Adaptation](#electronics-theme-adaptation)
14. [Code Examples](#code-examples)
15. [Mod Development Guide](#mod-development-guide)

---

## 1. Architecture Overview

```
Luanti Engine Architecture
==========================

                    ┌─────────────────────────────────────┐
                    │         Client (C++ + Lua)          │
                    │  ┌──────────┐        ┌──────────┐  │
                    │  │  Irrlicht │        │   GUI    │  │
                    │  │  Renderer │        │(Formspec)│  │
                    │  └──────────┘        └──────────┘  │
                    └─────────────────────────────────────┘
                             ↕ Network Protocol
                    ┌─────────────────────────────────────┐
                    │         Server (C++ + Lua)          │
                    │  ┌────────────────────────────────┐ │
                    │  │   ServerEnvironment            │ │
                    │  │   ├─ ServerActiveObjects       │ │
                    │  │   ├─ Map (ServerMap)           │ │
                    │  │   └─ Scripting (Lua API)       │ │
                    │  └────────────────────────────────┘ │
                    │  ┌────────────────────────────────┐ │
                    │  │   EmergeManager                │ │
                    │  │   ├─ Mapgen                    │ │
                    │  │   ├─ BiomeGen                  │ │
                    │  │   └─ Block Modifiers           │ │
                    │  └────────────────────────────────┘ │
                    │  ┌────────────────────────────────┐ │
                    │  │   Database Layer               │ │
                    │  │   ├─ MapBlocks                 │ │
                    │  │   ├─ Player Data               │ │
                    │  │   └─ Mod Storage              │ │
                    │  └────────────────────────────────┘ │
                    └─────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Server** | `src/server.cpp`, `src/server.h` | Main game server logic |
| **Client** | `src/client/` | Rendering and input handling |
| **ServerEnvironment** | `src/serverenvironment.h` | Game world container |
| **ServerMap** | `src/servermap.h` | Voxel world storage |
| **MapBlock** | `src/mapblock.h` | 16x16x16 voxel chunk |
| **EmergeManager** | `src/emerge.h` | World generation coordinator |
| **Mapgen** | `src/mapgen/mapgen.h` | Terrain generation |
| **Scripting** | `src/script/` | Lua API bindings |

---

## 2. Core Engine Architecture

### 2.1 MapBlock Structure

The fundamental unit of world storage is the **MapBlock** - a 16x16x16 cube of nodes.

```cpp
// From src/mapblock.h
class MapBlock {
    v3s16 m_pos;                  // Position in blocks
    MapNode *data;                // 4096 nodes (16x16x16)
    NodeMetadataList m_node_metadata;
    StaticObjectList m_static_objects;
    NodeTimerList m_node_timers;
    u16 m_lighting_complete;      // 12-bit flags for light propagation
    bool m_generated;             // Has mapgen finished this block?
    bool is_underground;          // Sunlight propagation hint
    u32 m_timestamp;              // Last save time
    u32 m_modified;               // Modification state
    u16 m_refcount;               // For memory management
    bool m_orphan;                // Deleted but not freed
};
```

**Key Concepts:**
- **Monoblock Optimization:** If all 4096 nodes are identical, only one is stored
- **Modification Tracking:** Blocks are marked dirty and saved on unload
- **Light Baking:** Sunlight and artificial light are pre-calculated per block
- **Reference Counting:** Used for memory management on server and client

### 2.2 MapNode Structure

Each voxel in the world is a `MapNode`:

```cpp
// Content encoding (simplified)
struct MapNode {
    u16 param0;  // Content ID (node type)
    u8  param1;  // Parameters (e.g., wall mounted direction)
    u8  param2;  // Extended parameters (e.g., facedir, level)
};
```

**Content ID Mapping:**
- **param0**: Index into NodeDefManager (defines node properties)
- **param1**: Legacy parameters (light, rotation)
- **param2**: Extended parameters (facing direction, liquid level, etc.)

### 2.3 ServerEnvironment

The `ServerEnvironment` manages all game objects:

```cpp
class ServerEnvironment : public Environment {
    std::unique_ptr<ServerMap> m_map;
    std::vector<RemotePlayer*> m_players;
    ActiveObjectMgr m_ao_manager;  // Active objects
    ActiveBlockList m_active_blocks;
    std::vector<ActiveBlockModifier*> m_abms;
    std::vector<LoadingBlockModifierDef*> m_lbms;
    u32 m_game_time;                // Total game time
    float m_max_lag_estimate;
};
```

**Responsibilities:**
- Load/unload blocks based on player proximity
- Step ABMs (Active Block Modifiers)
- Manage active objects (entities)
- Save/load player data
- Track game time

---

## 3. World Storage Format

### 3.1 World Directory Structure

```
world_name/
├── auth.txt          # Legacy auth (SRP verifier)
├── auth.sqlite       # SQLite auth backend
├── env_meta.txt      # Game time, time of day
├── ipban.txt         # Banned IPs
├── map_meta.txt      # Map seed
├── map.sqlite        # Main map data
├── players/          # Player data files
│   ├── player1
│   └── player2
└── world.mt          # World configuration
```

### 3.2 map.sqlite Schema

```sql
CREATE TABLE `blocks` (
    `x` INTEGER,
    `y` INTEGER,
    `z` INTEGER,
    `data` BLOB NOT NULL,
    PRIMARY KEY (`x`, `z`, `y`)
);
```

**Position Encoding (legacy, pre-5.12.0):**
```c
pos = (z << 24) + (y << 12) + x;
```

### 3.3 MapBlock Serialization Format

```
u8 version                      // Map format version (29)
u8 flags                        // is_underground, day_night_differs, etc.
u16 lighting_complete           // 12 directional flags

// For version 29+:
u32 timestamp                   // Last save time
u8 name_id_mapping_version
u16 num_name_id_mappings
    foreach mapping:
        u16 id
        u16 name_len
        u8[name_len] name

u8 content_width                // 1 or 2 bytes per content ID
u8 params_width                 // Always 2

// Node data (zstd compressed in v29)
u16[4096] OR u8[4096]           // param0 (content IDs)
u8[4096]                        // param1
u8[4096]                        // param2

// Node metadata list
u8 version
u16 count
    foreach metadata:
        u16 position
        u32 num_vars
        foreach var:
            u16 key_len
            u8[key_len] key
            u32 val_len
            u8[val_len] value
            u8 is_private
        serialized inventory

// Node timers
u8 data_length (always 10)
u16 num_timers
    foreach timer:
        u16 position
        s32 timeout * 1000
        s32 elapsed * 1000

// Static objects
u8 version (always 0)
u16 count
    foreach object:
        u8 type
        s32 pos_x * 10000
        s32 pos_y * 10000
        s32 pos_z * 10000
        u16 data_size
        u8[data_size] data
```

### 3.4 Player File Format

```
hp = 20
name = playername
pitch = 0.0
position = (0.0, 0.0, 0.0)
version = 1
yaw = 0.0
PlayerArgsEnd

List main 32
    Item default:dirt 99
    Item default:torch 13
    ...
EndInventoryList

List craft 9
    Empty
    ...
EndInventoryList

EndInventory
```

---

## 4. Network Protocol

### 4.1 Protocol Versions

```cpp
// Latest protocol version
extern const u16 LATEST_PROTOCOL_VERSION;

// Supported range
constexpr u16 SERVER_PROTOCOL_VERSION_MIN = 37;
constexpr u16 CLIENT_PROTOCOL_VERSION_MIN = 37;
```

### 4.2 ToClient Commands (Server -> Client)

| Command | ID | Purpose |
|---------|-----|---------|
| TOCLIENT_HELLO | 0x02 | Initial handshake |
| TOCLIENT_AUTH_ACCEPT | 0x03 | Authentication successful |
| TOCLIENT_BLOCKDATA | 0x20 | Send a MapBlock |
| TOCLIENT_ADDNODE | 0x21 | Add single node |
| TOCLIENT_REMOVENODE | 0x22 | Remove single node |
| TOCLIENT_INVENTORY | 0x27 | Send inventory |
| TOCLIENT_TIME_OF_DAY | 0x29 | Update time |
| TOCLIENT_CHAT_MESSAGE | 0x2F | Chat/message |
| TOCLIENT_ACTIVE_OBJECT_REMOVE_ADD | 0x31 | Entity updates |
| TOCLIENT_HP | 0x33 | Player health |
| TOCLIENT_MOVE_PLAYER | 0x34 | Teleport player |
| TOCLIENT_MEDIA | 0x38 | Send media files |
| TOCLIENT_NODEDEF | 0x3a | Node definitions |
| TOCLIENT_ITEMDEF | 0x3d | Item definitions |
| TOCLIENT_SHOW_FORMSPEC | 0x44 | Show GUI |
| TOCLIENT_SPAWN_PARTICLE | 0x46 | Spawn particle |
| TOCLIENT_HUDADD | 0x49 | Add HUD element |
| TOCLIENT_SET_SKY | 0x4f | Change sky |

### 4.3 ToServer Commands (Client -> Server)

| Command | ID | Purpose |
|---------|-----|---------|
| TOSERVER_INIT | 0x02 | Initial connection |
| TOSERVER_INIT2 | 0x11 | Post-auth ACK |
| TOSERVER_PLAYERPOS | 0x23 | Player position/movement |
| TOSERVER_GOTBLOCKS | 0x24 | Acknowledge received blocks |
| TOSERVER_DELETEDBLOCKS | 0x25 | Acknowledge deleted blocks |
| TOSERVER_INTERACT | 0x39 | Dig/place/use |
| TOSERVER_CHAT_MESSAGE | 0x32 | Chat/command |
| TOSERVER_DAMAGE | 0x35 | Self-damage |
| TOSERVER_REQUEST_MEDIA | 0x40 | Request missing media |

### 4.4 Packet Structure Example

```cpp
// TOCLIENT_BLOCKDATA
struct BlockDataPacket {
    u16 command;        // 0x20
    v3s16 position;     // Block position
    u8* data;           // Serialized MapBlock
    u32 data_length;    // Length of data
};
```

---

## 5. Map Generation System

### 5.1 Available Mapgens

```cpp
enum MapgenType {
    MAPGEN_V7,        // Default - varied terrain
    MAPGEN_VALLEYS,   // River valleys
    MAPGEN_CARPATHIAN,// Mountains
    MAPGEN_V5,        // Improved v6
    MAPGEN_FLAT,      // Flat terrain
    MAPGEN_FRACTAL,   // Mathematical fractal
    MAPGEN_SINGLENODE,// Single node (for testing)
    MAPGEN_V6,        // Classic
    MAPGEN_INVALID,
};
```

### 5.2 Mapgen Flags

```cpp
#define MG_CAVES       0x02
#define MG_DUNGEONS    0x04
#define MG_LIGHT       0x10
#define MG_DECORATIONS 0x20
#define MG_BIOMES      0x40
#define MG_ORES        0x80
```

### 5.3 Mapgen Architecture

```cpp
class Mapgen {
public:
    s32 seed;
    int water_level;
    int mapgen_limit;
    u32 flags;
    MMVManip *vm;
    EmergeParams *m_emerge;
    const NodeDefManager *ndef;
    u32 blockseed;
    s16 *heightmap;
    biome_t *biomemap;
    v3s16 csize;  // Chunk size
    BiomeGen *biomegen;
    GenerateNotifier gennotify;

    virtual void makeChunk(BlockMakeData *data) = 0;
    virtual int getGroundLevelAtPoint(v2s16 p) = 0;
};
```

### 5.4 MapgenBasic

Most mapgens inherit from `MapgenBasic` for common functionality:

```cpp
class MapgenBasic : public Mapgen {
    virtual void generateBiomes();
    virtual void dustTopNodes();
    virtual void generateCavesNoiseIntersection(s16 max_stone_y);
    virtual void generateCavesRandomWalk(s16 max_stone_y, s16 large_cave_ymax);
    virtual bool generateCavernsNoise(s16 max_stone_y);
    virtual void generateDungeons(s16 max_stone_y);
};
```

**Generation Pipeline:**
1. `generateBiomes()` - Assign biomes based on heat/humidity
2. `generateTerrain()` - Create heightmap (per-mapgen)
3. `generateCaves*()` - Carve cave systems
4. `generateDungeons()` - Add underground structures
5. `dustTopNodes()` - Add surface nodes (grass, sand, etc.)
6. `calcLighting()` - Bake sunlight and artificial light

### 5.5 EmergeManager

Coordinates background world generation:

```cpp
class EmergeManager {
    bool enable_mapgen_debug_info;
    int gen_notifier_on;
    std::set<u32> gen_notify_on_deco_ids;

    // Generate block immediately
    void emitBlock(v3s16 blockpos);

    // Generate block in background
    void enqueueBlockEmerge(v3s16 blockpos);

    // Cancel pending generation
    void cancelBlockEmerge(v3s16 blockpos);
};
```

---

## 6. Mod Loading System

### 6.1 Mod Discovery Paths

```
Load order (highest to lowest priority):
1. worldmods/          (World-specific mods)
2. games/<game>/mods/  (Game mods)
3. mods/              (Global mods)
4. share/minetest/mods/ (System mods)
```

### 6.2 Mod Configuration (world.mt)

```ini
gameid = devtest
backend = sqlite3
player_backend = sqlite3
auth_backend = files
mod_storage_backend = sqlite3

load_mod_my_mod = true
load_mod_other_mod = mods/other_mod
load_mod_disabled = false
```

### 6.3 Mod Dependency Resolution

Each mod has a `mod.conf`:

```ini
name = my_mod
description = My awesome mod
depends = default, another_mod
optional_depends = optional_mod
```

**Loading Order:**
1. Resolve dependency tree
2. Load dependencies first
3. Load mod in topological order
4. Fail if circular dependency detected

### 6.4 Builtin Mods

The engine includes builtin Lua code in `builtin/`:

```
builtin/
├── game/           # Core game logic
│   ├── init.lua
│   ├── register.lua
│   ├── item.lua
│   ├── falling.lua
│   └── ...
├── client/         # Client-side scripts
├── mainmenu/       # Main menu UI
├── emerge/         # Mapgen scripting
└── common/         # Shared utilities
```

### 6.5 Registration System

```lua
-- Items/Nodes
core.register_item(name, itemdef)
core.register_node(name, nodedef)
core.register_craftitem(name, craftdef)
core.register_tool(name, tooldef)

-- Entities
core.register_entity(name, prototype)

-- Aliases
core.register_alias(alias, original_name)

-- Block modifiers
core.register_abm(spec)
core.register_lbm(spec)

-- Callbacks
core.register_on_generated(function(minp, maxp, blockseed) end)
core.register_on_newplayer(function(player) end)
core.register_on_chat_message(function(name, message) end)
core.register_globalstep(function(dtime) end)
```

---

## 7. Lua API Reference

### 7.1 Core Namespace

```lua
-- Note: 'core' is the new name (replaces 'minetest')
-- 'minetest' remains as an alias for compatibility
```

### 7.2 Environment API

```lua
-- Node manipulation
core.set_node(pos, node)
core.get_node(pos) -> node
core.remove_node(pos)
core.swap_node(pos, node)
core.bulk_set_node({pos1, pos2, ...}, node)

-- Area operations
core.find_nodes_in_area(minp, maxp, nodenames) -> {{x,y,z},...}
core.find_node_near(pos, radius, nodenames) -> pos
core.find_nodes_in_area_under_air(minp, maxp, nodenames) -> {pos,...}
core.delete_area(pos1, pos2)

-- Lighting
core.get_node_light(pos, timeofday) -> 0-15 or nil
core.fix_light(pos1, pos2)

-- Meta and timers
core.get_meta(pos) -> NodeMetaRef
core.get_node_timer(pos) -> NodeTimerRef

-- Entities
core.add_entity(pos, entityname) -> ObjectRef
core.add_item(pos, itemstack) -> ObjectRef
core.get_objects_inside_radius(pos, radius) -> {ObjectRef,...}

-- Time
core.get_timeofday() -> 0-1
core.set_timeofday(val)
core.get_gametime() -> seconds
core.get_day_count() -> days
```

### 7.3 Mapgen API

```lua
-- Register mapgen
core.register_mapgen(name, mapgen_func)

-- Get/set mapgen params
core.get_mapgen_params() -> {mgtype, seed, ...}
core.set_mapgen_params(params)

-- Noise functions
core.get_perlin_noise(noiseparams) -> PerlinNoiseRef
core.get_value_noise(seeddiff, octaves, persistence, scale)

-- Biome
core.register_biome(biomedef)
core.get_biome_name(biome_id) -> string
core.get_biome_id(biome_name) -> id

-- Decorations
core.register_decoration(decodef)
core.register_ore(oredef)

-- Schematics
core.register_schematic(schemdef)
core.place_schematic(pos, schematic, ...)
core.place_schematic_on_vmanip(vm, pos, ...)
```

### 7.4 Player API

```lua
-- Get players
core.get_connected_players() -> {PlayerRef,...}
core.get_player_by_name(name) -> PlayerRef

-- Movement
core.kick_player(name, reason)
core.set_player_password(name, password_hash)

-- HUD
core.hud_add(player, huddef) -> id
core.hud_remove(player, id)
core.hud_change(player, id, stat, value)
```

### 7.5 Item/Node Definition API

```lua
core.register_node("modname:nodename", {
    description = "Node Name",
    tiles = {"texture.png", "^overlay.png"},
    inventory_image = "item.png",
    wield_image = "wield.png",
    wield_scale = {x=1, y=1, z=1},

    -- Drawtypes
    drawtype = "normal",
    visual_scale = 1.0,
    mesh = "model.b3d",

    -- Node properties
    paramtype = "none",
    paramtype2 = "none",
    is_ground_content = true,
    sunlight_propagates = false,
    walkable = true,
    pointable = true,
    diggable = true,
    climbable = false,
    buildable_to = false,
    liquidtype = "none",
    liquid_alternative_flowing = "",
    liquid_alternative_source = "",
    liquid_viscosity = 0,
    drowning = 0,
    light_source = 0,
    damage_per_second = 0,

    -- Groups
    groups = {cracky=3, oddly_breakable_by_hand=3},

    -- Connects
    connects_to = {"group:wall"},

    -- Drop
    drop = "",

    -- Callbacks
    on_construct = function(pos) end,
    on_destruct = function(pos) end,
    after_destruct = function(pos, oldnode) end,
    on_timer = function(pos, elapsed) end,
    on_receive_fields = function(pos, formname, fields, sender) end,
    on_punch = function(pos, node, puncher, pointed_thing) end,
    on_rightclick = function(pos, node, clicker, thing) end,
    on_dig = function(pos, node, digger) end,
    on_place = function(itemstack, placer, pointed_thing) end,
})
```

---

## 8. Active Objects & Entities

### 8.1 ServerActiveObject

```cpp
class ServerActiveObject : public ActiveObject {
public:
    virtual void step(float dtime, bool send_recommended);
    virtual std::string getClientInitializationData(u16 protocol_version);
    virtual void getStaticData(std::string *result) const;
    virtual bool isStaticAllowed() const;
    virtual bool shouldUnload() const;
    virtual u32 punch(v3f dir, const ToolCapabilities &toolcap, ...);
    virtual void rightClick(ServerActiveObject *clicker);
    virtual void setHP(s32 hp, const PlayerHPChangeReason &reason);
    virtual u16 getHP() const;
    virtual std::string getGUID() const = 0;
};
```

### 8.2 LuaEntitySAO

```cpp
class LuaEntitySAO : public UnitSAO {
    std::string m_init_name;      // Entity name
    std::string m_init_state;     // Initial state
    v3f m_velocity;               // Movement velocity
    v3f m_acceleration;           // Acceleration
    std::string m_texture_modifier; // Texture overrides
};
```

### 8.3 Lua Entity Registration

```lua
core.register_entity("modname:entity", {
    initial_properties = {
        hp_max = 10,
        physical = true,
        weight = 5,
        collisionbox = {-0.5, -0.5, -0.5, 0.5, 0.5, 0.5},
        visual = "sprite",
        visual_size = {x=1, y=1},
        mesh = "model.b3d",
        textures = {"texture.png"},
        colors = {},
        spritediv = {x=1, y=1},
        initial_sprite_basepos = {x=0, y=0},
        makes_footstep_sound = true,
        stepheight = 0,
        automatic_face_movement_dir = 0.0,
        automatic_face_movement_max_rotation_per_sec = -1,
        backface_culling = true,
        glow = 0,
        nametag = "",
        infotext = "",
        static_save = true,
    },

    on_activate = function(self, staticdata, dtime_s)
        -- Called when entity is created/loaded
    end,

    on_deactivate = function(self)
        -- Called when entity is removed/unloaded
    end,

    on_step = function(self, dtime, moveresult)
        -- Called every server step
    end,

    on_punch = function(self, hitter, time_from_last_punch, tool_capabilities, dir, damage)
        -- Called when punched
    end,

    on_death = function(self, killer)
        -- Called when entity dies
    end,

    on_rightclick = function(self, clicker)
        -- Called when right-clicked
    end,

    on_attach_child = function(self, child)
        -- Called when child entity attaches
    end,

    on_detach_child = function(self, child)
        -- Called when child entity detaches
    end,

    on_detach = function(self, parent)
        -- Called when this entity detaches from parent
    end,

    get_staticdata = function(self)
        -- Return data to save
        return core.serialize(staticdata)
    end,
})
```

### 8.4 PlayerSAO

Player objects are `PlayerSAO` (Server Active Object):

```cpp
class PlayerSAO : public UnitSAO {
    RemotePlayer *m_player;
    InventoryList *m_wielded_item;
    bool m_position_sent;
    float m_breath;
    s16 m_look_pitch;
    s16 m_look_yaw;
    bool m_no_limbs;
};
```

---

## 9. Database Backends

### 9.1 Available Backends

| Backend | Type | Use Case |
|---------|------|----------|
| SQLite3 | MapDatabase | Default, embedded |
| LevelDB | MapDatabase | High performance, needs compilation |
| Redis | MapDatabase | Distributed caching |
| PostgreSQL | Database | Enterprise, large scale |
| Dummy | All | Testing, in-memory |

### 9.2 Database Interface

```cpp
class Database {
    virtual void beginSave() = 0;
    virtual void endSave() = 0;
    virtual bool initialized() const;
    virtual void verifyDatabase() {};
};

class MapDatabase : public Database {
    virtual bool saveBlock(const v3s16 &pos, std::string_view data) = 0;
    virtual void loadBlock(const v3s16 &pos, std::string *block) = 0;
    virtual bool deleteBlock(const v3s16 &pos) = 0;
    virtual void listAllLoadableBlocks(std::vector<v3s16> &dst) = 0;
};

class PlayerDatabase {
    virtual void savePlayer(RemotePlayer *player) = 0;
    virtual bool loadPlayer(RemotePlayer *player, PlayerSAO *sao) = 0;
    virtual bool removePlayer(const std::string &name) = 0;
    virtual void listPlayers(std::vector<std::string> &res) = 0;
};

class AuthDatabase {
    virtual bool getAuth(const std::string &name, AuthEntry &res) = 0;
    virtual bool saveAuth(const AuthEntry &authEntry) = 0;
    virtual bool createAuth(AuthEntry &authEntry) = 0;
    virtual bool deleteAuth(const std::string &name) = 0;
};

class ModStorageDatabase : public Database {
    virtual void getModEntries(const std::string &modname, StringMap *storage) = 0;
    virtual bool getModEntry(const std::string &modname,
        const std::string &key, std::string *value) = 0;
    virtual bool setModEntry(const std::string &modname,
        const std::string &key, std::string_view value) = 0;
};
```

---

## 10. Integration Points

### 10.1 Custom Mapgen for Educational Content

**Hook Point:** Create custom mapgen inheriting from `MapgenBasic`

```cpp
// In a custom C++ module or via Lua mapgen API
class StudyLogMapgen : public MapgenBasic {
    virtual void makeChunk(BlockMakeData *data) override {
        // Generate educational world structure
        // - Circuit board layout
        // - Tutorial areas
        // - Challenge rooms
    }
};
```

**Lua Alternative:**
```lua
core.register_mapgen("studylog", function(vm, p1, p2, seed)
    local data = {}
    -- Generate educational content
    for x = p1.x, p2.x do
    for z = p1.z, p2.z do
    for y = p1.y, p2.y do
        -- Place nodes based on educational plan
    end
    end
    end
end)
```

### 10.2 AI Agent Entities

**Hook Point:** Register custom LuaEntity for AI agents

```lua
core.register_entity("studylog:ai_tutor", {
    initial_properties = {
        visual = "mesh",
        mesh = "tutor_character.b3d",
        textures = {"tutor.png"},
        physical = false,
        collide_with_objects = false,
    },

    on_activate = function(self, staticdata)
        -- Connect to backend
        self.backend_url = core.settings:get("studylog.backend_url")
        self.agent_id = staticdata
    end,

    on_step = function(self, dtime)
        -- Check for backend messages
        -- Update animation
        -- Move toward target
    end,

    on_rightclick = function(self, clicker)
        -- Show chat interface
        -- Send to backend for AI response
    end,
})
```

### 10.3 Backend Communication

**Option A: HTTP API**
```lua
local http = require("core.http")

function send_to_backend(endpoint, data)
    local url = core.settings:get("studylog.backend_url") .. endpoint
    local json = core.write_json(data)

    http.fetch({
        url = url,
        post_data = json,
        method = "POST",
        extra_headers = {
            "Content-Type: application/json",
            "Authorization: Bearer " .. get_auth_token()
        }
    }, function(response)
        if response.succeeded then
            handle_backend_response(response.data)
        end
    end)
end
```

**Option B: Mod Channels (Server-Client)**
```lua
-- Server
core.register_on_joinplayer(function(player)
    core.mod_channel_join("studylog:" .. player:get_player_name())
end)

core.mod_channel_send("studylog:" .. player_name, message_data)

-- Client
core.register_on_modchannel_message(function(channel, sender, message)
    -- Handle backend message
end)
```

### 10.4 Student Progress Tracking

**Use Mod Storage:**
```lua
local storage = core.get_mod_storage()

-- Save progress
local function save_progress(student_id, lesson_id, score, time_spent)
    local key = student_id .. ":" .. lesson_id
    local data = {
        score = score,
        time_spent = time_spent,
        completed = true,
        timestamp = os.time()
    }
    storage:set_string(key, core.write_json(data))
end

-- Load progress
local function load_progress(student_id, lesson_id)
    local key = student_id .. ":" .. lesson_id
    local data_str = storage:get_string(key)
    if data_str ~= "" then
        return core.parse_json(data_str)
    end
    return nil
end
```

### 10.5 Asset Generation Pipeline

**Hook Point:** Dynamic texture/model loading

```lua
-- Generate textures on the fly
local function generate_circuit_texture(data)
    -- Use generate_texture or external tool
    -- Save to player's mod storage or temp dir
    -- Return texture name
end

-- Apply to node
core.register_node("studylog:dynamic_component", {
    tiles = { generate_circuit_texture({...}) },
    -- ...
})
```

---

## 11. StudyLoG.AI Integration

### 11.1 Educational World Generation

**Concept:** Procedurally generate tutorial worlds

```lua
-- studylog_mapgen.lua
local S = core.get_translator("studylog")

local circuit_nodes = {
    resistor = "studylog:resistor",
    capacitor = "studylog:capacitor",
    led = "studylog:led",
    battery = "studylog:battery",
    wire = "studylog:copper_wire",
}

local function generate_circuit_room(vm, room_min, room_max, lesson_data)
    -- Clear area
    for x = room_min.x, room_max.x do
    for y = room_min.y, room_max.y do
    for z = room_min.z, room_max.z do
        vm:set_node({x=x, y=y, z=z}, {name="air"})
    end
    end
    end

    -- Place circuit components based on lesson data
    for _, component in ipairs(lesson_data.components) do
        local pos = {
            x = room_min.x + component.x,
            y = room_min.y + component.y,
            z = room_min.z + component.z
        }
        local node_name = circuit_nodes[component.type]
        if node_name then
            local param2 = component.rotation or 0
            vm:set_node(pos, {name=node_name, param2=param2})
        end
    end

    -- Add wiring connections
    for _, wire in ipairs(lesson_data.wires) do
        -- Place wire nodes along path
    end
end

core.register_on_generated(function(minp, maxp, seed)
    -- Check if this chunk contains a lesson room
    local room_key = core.pos_to_string(minp)
    local lesson_data = get_lesson_for_room(room_key)

    if lesson_data then
        local vm = core.get_voxel_manip()
        local emin, emax = vm:read_from_map(minp, maxp)
        local data = vm:get_data()

        generate_circuit_room(vm, emin, emax, lesson_data)

        vm:set_data(data)
        vm:write_to_map(true)
        vm:update_liquids()
    end
end)
```

### 11.2 Interactive Tutorial System

```lua
-- studylog_tutorial.lua
local tutorials = {}

tutorials.basics = {
    name = "Basic Circuits",
    steps = {
        {
            title = "Welcome to Electronics!",
            text = "Let's learn how circuits work. First, find the battery.",
            objective = "find_battery",
            hint = "Look for the red block on the table",
            check = function(player)
                -- Check if player is near battery
                local pos = player:get_pos()
                return core.find_node_near(pos, 3, {"studylog:battery"})
            end
        },
        {
            title = "Connect the Battery",
            text = "Use copper wire to connect the battery to the LED.",
            objective = "connect_battery_led",
            hint = "Place wire between the battery (+) and LED (+)",
            check = function(player)
                -- Check if wire exists between battery and LED
            end
        },
        {
            title = "Complete the Circuit",
            text = "Connect the LED back to the battery (-) to complete the circuit.",
            objective = "complete_circuit",
            check = function(player)
                -- Check if circuit is complete
                -- Update LED state to ON
            end
        }
    }
}

local function start_tutorial(player, tutorial_id)
    local tutorial = tutorials[tutorial_id]
    if not tutorial then return end

    player:set_meta():set_string("studylog:active_tutorial", tutorial_id)
    player:set_meta():set_int("studylog:current_step", 1)

    show_hud(player, tutorial.steps[1])
end

local function show_hud(player, step)
    local hud = player:hud_add({
        hud_elem_type = "text",
        position = {x = 0.5, y = 0.1},
        text = step.title .. "\n" .. step.text,
        number = 0xFFFFFF,
        alignment = {x = 0, y = 0},
        offset = {x = 0, y = 0}
    })
    player:get_meta():set_int("studylog:hud_id", hud)
end

core.register_on_joinplayer(function(player)
    -- Resume tutorial if in progress
end)

core.register_globalstep(function(dtime)
    -- Check tutorial objectives
    for _, player in ipairs(core.get_connected_players()) do
        check_tutorial_progress(player)
    end
end)
```

### 11.3 AI Tutor Integration

```lua
-- studylog_ai_tutor.lua
local http = require("core.http")

local ai_tutors = {}

core.register_entity("studylog:ai_tutor", {
    initial_properties = {
        visual = "mesh",
        mesh = "tutor_bot.b3d",
        textures = {"tutor_bot.png"},
        physical = false,
        collisionbox = {-0.3, 0, -0.3, 0.3, 1.8, 0.3},
        visual_size = {x=1, y=1},
        makes_footstep_sound = true,
    },

    on_activate = function(self, staticdata)
        local data = core.parse_json(staticdata or "{}")
        self.tutor_name = data.name or "Sparky"
        self.personality = data.personality or "friendly"
        self.topic = data.topic or "electronics"
    end,

    on_rightclick = function(self, clicker)
        -- Show chat formspec
        local player_name = clicker:get_player_name()
        show_tutor_chat(player_name, self.tutor_name, self.topic)
    end,

    get_staticdata = function(self)
        return core.write_json({
            name = self.tutor_name,
            personality = self.personality,
            topic = self.topic
        })
    end,
})

function show_tutor_chat(player_name, tutor_name, topic)
    local formspec = [[
        size[6,4]
        textarea[0.25,0.25;5.75,2;chat_message;Message from ]] .. tutor_name .. [[;]
        field[0.25,2.5;4.5,0.5;response;Your response;]
        button_exit[4.75,2.5;1,0.5;send;Send]
    ]]

    core.show_formspec(player_name, "studylog:tutor_chat", formspec)
end

core.register_on_player_receive_fields(function(player, formname, fields)
    if formname == "studylog:tutor_chat" and fields.send then
        -- Send to backend for AI response
        send_tutor_message(player, fields.response)
    end
end)

function send_tutor_message(player, message)
    local backend_url = core.settings:get("studylog.backend_url")

    http.fetch({
        url = backend_url .. "/api/chat",
        post_data = core.write_json({
            message = message,
            context = {
                player = player:get_player_name(),
                current_lesson = player:get_meta():get_string("studylog:active_tutorial"),
                progress = get_player_progress(player)
            }
        }),
        method = "POST",
        extra_headers = {
            "Content-Type: application/json",
        }
    }, function(response)
        if response.succeeded then
            local result = core.parse_json(response.data)
            -- Display tutor response
            show_tutor_response(player, result.message)
        end
    end)
end
```

### 11.4 Progress Tracking

```lua
-- studylog_progress.lua
local storage = core.get_mod_storage()

local progress_schema = {
    -- player_name: {
    --     lessons = {
    --         [lesson_id] = {
    --             completed = boolean,
    --             score = number,
    --             time_spent = number,
    --             attempts = number,
    --             last_attempt = timestamp
    --         }
    --     },
    --     total_time = number,
    --     achievements = {achievement_id, ...}
    -- }
}

function init_player(player)
    local player_name = player:get_player_name()
    local data = storage:get_string("progress:" .. player_name)

    if data == "" then
        -- Initialize new player
        storage:set_string("progress:" .. player_name, core.write_json({
            lessons = {},
            total_time = 0,
            achievements = {},
            started = os.time()
        }))
    end
end

function record_lesson_progress(player, lesson_id, result)
    local player_name = player:get_player_name()
    local data_str = storage:get_string("progress:" .. player_name)
    local data = core.parse_json(data_str)

    if not data.lessons[lesson_id] then
        data.lessons[lesson_id] = {
            attempts = 0,
            time_spent = 0
        }
    end

    local lesson = data.lessons[lesson_id]
    lesson.attempts = lesson.attempts + 1
    lesson.time_spent = lesson.time_spent + (result.time or 0)
    lesson.last_attempt = os.time()

    if result.completed then
        lesson.completed = true
        lesson.score = result.score

        -- Check for achievements
        check_achievements(player, data)

        -- Notify backend
        notify_lesson_completed(player, lesson_id, result)
    end

    storage:set_string("progress:" .. player_name, core.write_json(data))
end

function check_achievements(player, data)
    local unlocked = {}

    -- First lesson completed
    if count_completed(data) == 1 then
        table.insert(unlocked, "first_lesson")
    end

    -- Perfect score
    for lesson_id, lesson in pairs(data.lessons) do
        if lesson.score == 100 then
            table.insert(unlocked, "perfect_score_" .. lesson_id)
        end
    end

    -- Time achievements
    if data.total_time > 3600 then
        table.insert(unlocked, "dedicated_student")
    end

    -- Award achievements
    for _, achievement in ipairs(unlocked) do
        award_achievement(player, achievement)
    end
end

function notify_lesson_completed(player, lesson_id, result)
    local backend_url = core.settings:get("studylog.backend_url")

    -- Send to backend for progress tracking
    -- Could use HTTP or mod channels
end
```

---

## 12. DMLoG.AI Integration

### 12.1 Dungeon Generation

```lua
-- dmlog_dungeon.lua
local dungeon_gen = {}

dungeon_gen.room_templates = {
    -- Room types for procedural dungeons
    entrance = {
        size = {x=7, y=4, z=7},
        features = {"stairs", "chest", "lighting"}
    },
    corridor = {
        size = {x=3, y=3, z=11},
        features = {"lighting", "monsters"}
    },
    chamber = {
        size = {x=11, y=5, z=11},
        features = {"pillars", "encounter", "loot"}
    },
    boss_room = {
        size = {x=15, y=6, z=15},
        features = {"boss", "pillars", "loot_chest", "exit"}
    }
}

function dungeon_gen.generate(vm, pos, dungeon_data)
    local rooms = {}
    local connections = {}

    -- Generate rooms using BSP or wave function collapse
    for i, room_spec in ipairs(dungeon_data.layout) do
        local room = generate_room(vm, pos, room_spec)
        table.insert(rooms, room)
    end

    -- Connect rooms
    for i = 1, #rooms - 1 do
        connect_rooms(vm, rooms[i], rooms[i+1])
    end

    -- Place encounters
    place_encounters(vm, rooms, dungeon_data.encounters)

    return rooms
end

function generate_room(vm, offset, room_spec)
    local template = dungeon_gen.room_templates[room_spec.type]
    local size = template.size

    local room_min = vector.add(offset, room_spec.position)
    local room_max = vector.add(room_min, size)

    -- Clear room
    for x = room_min.x, room_max.x do
    for y = room_min.y, room_max.y do
    for z = room_min.z, room_max.z do
        if x == room_min.x or x == room_max.x or
           z == room_min.z or z == room_max.z or
           y == room_min.y or y == room_max.y then
            vm:set_node({x=x, y=y, z=z}, {name="dmlog:stone_wall"})
        else
            vm:set_node({x=x, y=y, z=z}, {name="air"})
        end
    end
    end
    end

    -- Add features
    for _, feature in ipairs(template.features) do
        add_feature(vm, room_min, room_max, feature)
    end

    return {min=room_min, max=room_max, type=room_spec.type}
end

-- Register mapgen callback
core.register_on_generated(function(minp, maxp, seed)
    local vm = core.get_voxel_manip()
    local emin, emax = vm:read_from_map(minp, maxp)

    -- Check for dungeon placement
    local dungeon_data = get_dungeon_for_area(minp, maxp)
    if dungeon_data then
        dungeon_gen.generate(vm, {x=0, y=0, z=0}, dungeon_data)
        vm:write_to_map(true)
    end
end)
```

### 12.2 Ranch Animal Behaviors

```lua
-- dmlog_ranch.lua
local animal_behaviors = {}

-- Define animal types
animal_behaviors.cow = {
    visual = "mesh",
    mesh = "cow.b3d",
    textures = {"cow.png"},
    collisionbox = {-0.4, -0.4, -0.4, 0.4, 0.4, 0.4},

    behaviors = {
        graze = {
            priority = 1,
            interval = 5,
            action = function(self)
                -- Find grass and eat
            end
        },
        flee = {
            priority = 10,
            trigger = function(self)
                -- Check for nearby threats
            end,
            action = function(self)
                -- Run away
            end
        },
        group = {
            priority = 2,
            interval = 10,
            action = function(self)
                -- Stay near other cows
            end
        }
    }
}

animal_behaviors.chicken = {
    -- Similar structure
}

-- Register entities
for animal_name, animal_def in pairs(animal_behaviors) do
    core.register_entity("dmlog:" .. animal_name, {
        initial_properties = {
            visual = animal_def.visual,
            mesh = animal_def.mesh,
            textures = animal_def.textures,
            collisionbox = animal_def.collisionbox,
            physical = true,
        },

        on_activate = function(self, staticdata)
            self.behaviors = animal_def.behaviors
            self.current_behavior = "idle"
            self.behavior_timer = 0
        end,

        on_step = function(self, dtime)
            self.behavior_timer = self.behavior_timer + dtime

            -- Check for high-priority triggers
            for behavior_name, behavior in pairs(self.behaviors) do
                if behavior.trigger and behavior.trigger(self) then
                    self.current_behavior = behavior_name
                    break
                end
            end

            -- Execute current behavior
            local behavior = self.behaviors[self.current_behavior]
            if behavior and self.behavior_timer >= (behavior.interval or 1) then
                behavior.action(self)
                self.behavior_timer = 0
            end
        end,
    })
end
```

### 12.3 Fishing Mechanics

```lua
-- dmlog_fishing.lua
local fishing = {}

fishing.fish_types = {
    {name = "trout", weight = 50, size = {min=0.3, max=0.6},
     habitats = {"river", "lake"}},
    {name = "salmon", weight = 30, size = {min=0.5, max=1.0},
     habitats = {"river"}},
    {name = "bass", weight = 40, size = {min=0.4, max=0.8},
     habitats = {"lake", "ocean"}},
    {name = "legendary_fish", weight = 1, size = {min=2.0, max=3.0},
     habitats = {"deep_ocean"}, rare = true},
}

-- Fishing rod item
core.register_tool("dmlog:fishing_rod", {
    description = "Fishing Rod",
    inventory_image = "fishing_rod.png",
    tool_capabilities = {
        max_drop_level = 0,
        groupcaps = {}
    },

    on_use = function(itemstack, user, pointed_thing)
        local player_name = user:get_player_name()
        local pos = user:get_pos()

        -- Check if near water
        if not near_water(pos) then
            core.chat_send_player(player_name, "You need to be near water to fish!")
            return itemstack
        end

        -- Start fishing
        start_fishing(user, itemstack)
        return itemstack
    end,
})

function start_fishing(player, rod)
    local player_name = player:get_player_name()

    -- Spawn bobber entity
    local pos = player:get_pos()
    local dir = player:get_look_dir()
    local bobber_pos = vector.add(pos, vector.multiply(dir, 3))

    local bobber = core.add_entity(bobber_pos, "dmlog:bobber")
    if bobber then
        bobber:set_attribute("owner", player_name)

        -- Set fishing state
        player:get_meta():set_string("dmlog:fishing_state", "waiting")
        player:get_meta():set_int("dmlog:bobber_id", bobber:get_luaentity().id)

        core.chat_send_player(player_name, "Cast! Wait for a bite...")
    end
end

-- Bobber entity
core.register_entity("dmlog:bobber", {
    initial_properties = {
        visual = "sprite",
        textures = {"bobber.png"},
        physical = true,
        collisionbox = {-0.1, -0.1, -0.1, 0.1, 0.1, 0.1},
    },

    on_activate = function(self, staticdata)
        self.object:set_velocity({x=0, y=-2, z=0})
        self.bite_timer = 0
        self.waiting_time = math.random(10, 30)
    end,

    on_step = function(self, dtime)
        -- Check if in water
        local pos = self.object:get_pos()
        local node = core.get_node(pos)

        if node.name == "default:water_source" or
           node.name == "default:river_water_source" then
            self.object:set_velocity({x=0, y=0, z=0})

            -- Wait for fish
            self.bite_timer = self.bite_timer + dtime
            if self.bite_timer >= self.waiting_time then
                -- Fish biting!
                self.biting = true
                trigger_bite(self)
            end
        end
    end,

    on_punch = function(self, puncher, time_from_last_punch, tool_capabilities, dir, damage)
        if self.biting then
            -- Caught fish!
            catch_fish(puncher)
            self.object:remove()
        else
            -- Reeled in empty
            self.object:remove()
        end
    end,
})

function catch_fish(player)
    local player_name = player:get_player_name()

    -- Determine fish type based on location and rarity
    local fish = select_fish_type(player:get_pos())

    if fish then
        local fish_stack = ItemStack("dmlog:" .. fish.name)
        local inv = player:get_inventory()
        if inv:add_item("main", fish_stack) then
            core.chat_send_player(player_name,
                "You caught a " .. fish.name .. "!")

            -- Record catch
            record_catch(player, fish)
        else
            core.chat_send_player(player_name,
                "Inventory full! Fish got away...")
        end
    else
        core.chat_send_player(player_name, "The fish got away!")
    end
end

function select_fish_type(pos)
    local habitat = get_habitat(pos)
    local total_weight = 0

    for _, fish in ipairs(fishing.fish_types) do
        if has_value(fish.habitats, habitat) then
            total_weight = total_weight + fish.weight
        end
    end

    local roll = math.random() * total_weight
    local cumulative = 0

    for _, fish in ipairs(fishing.fish_types) do
        if has_value(fish.habitats, habitat) then
            cumulative = cumulative + fish.weight
            if roll < cumulative then
                return fish
            end
        end
    end

    return fishing.fish_types[1]
end

function record_catch(player, fish)
    -- Update player's fishing stats
    local storage = core.get_mod_storage()
    local player_name = player:get_player_name()

    local key = "fishing:" .. player_name
    local data = storage:get_string(key)

    local stats
    if data ~= "" then
        stats = core.parse_json(data)
    else
        stats = {catches = {}, total = 0, largest = 0}
    end

    table.insert(stats.catches, {
        fish = fish.name,
        size = math.random() * (fish.size.max - fish.size.min) + fish.size.min,
        time = os.time()
    })
    stats.total = stats.total + 1

    storage:set_string(key, core.write_json(stats))
end
```

---

## 13. Electronics Theme Adaptation

### 13.1 Component Block Types

```lua
-- electronics_nodes.lua

-- Resistor
core.register_node("electronics:resistor", {
    description = "Resistor",
    drawtype = "nodebox",
    node_box = {
        type = "fixed",
        fixed = {
            {-0.5, -0.125, -0.125, 0.5, 0.125, 0.125},  -- Body
            {-0.625, -0.0625, -0.0625, -0.5, 0.0625, 0.0625},  -- Lead 1
            {0.5, -0.0625, -0.0625, 0.625, 0.0625, 0.0625},  -- Lead 2
        }
    },
    tiles = {"resistor.png"},
    groups = {dig_immediate=2, component=1},
    paramtype = "light",
    paramtype2 = "facedir",

    on_construct = function(pos)
        local meta = core.get_meta(pos)
        meta:set_string("resistance", "1000")  -- 1k ohm default
        meta:set_string("tolerance", "5")      -- 5%
    end,

    on_rightclick = function(pos, node, clicker)
        show_resistor_formspec(pos)
    end,
})

function show_resistor_formspec(pos)
    local meta = core.get_meta(pos)
    local resistance = meta:get_string("resistance")

    local formspec = [[
        size[4,3]
        field[0.5,1;3.5,1;resistance;Resistance (ohms);]] .. resistance .. [[]
        button_exit[1,2;2,1;save;Save]
    ]]

    core.show_formspec(clicker:get_player_name(),
        "electronics:resistor_" .. core.pos_to_string(pos),
        formspec)
end

-- Capacitor
core.register_node("electronics:capacitor", {
    description = "Capacitor",
    drawtype = "nodebox",
    node_box = {
        type = "fixed",
        fixed = {
            {-0.25, -0.5, -0.25, 0.25, 0.5, 0.25},  -- Cylinder
        }
    },
    tiles = {"capacitor_side.png", "capacitor_top.png"},
    groups = {dig_immediate=2, component=1},
    paramtype = "light",
    paramtype2 = "facedir",

    on_construct = function(pos)
        local meta = core.get_meta(pos)
        meta:set_string("capacitance", "100")  -- 100uF default
        meta:set_string("voltage", "16")        -- 16V rating
    end,
})

-- LED
core.register_node("electronics:led", {
    description = "LED",
    drawtype = "nodebox",
    node_box = {
        type = "fixed",
        fixed = {
            {-0.125, -0.125, -0.125, 0.125, 0.25, 0.125},  -- Bulb
            {-0.0625, -0.375, -0.0625, 0.0625, -0.125, 0.0625},  -- Lead 1
            {0.0625, -0.375, -0.0625, 0.1875, -0.125, 0.0625},  -- Lead 2
        }
    },
    tiles = {{"led.png^[colorize:#FF0000:255"}},  -- Red default
    groups = {dig_immediate=2, component=1, light=1},
    paramtype = "light",
    light_source = 3,  -- Dim when off

    on_construct = function(pos)
        local meta = core.get_meta(pos)
        meta:set_string("color", "red")
        meta:set_int("state", 0)  -- 0 = off, 1 = on
    end,
})

-- Battery
core.register_node("electronics:battery", {
    description = "Battery",
    drawtype = "nodebox",
    node_box = {
        type = "fixed",
        fixed = {
            {-0.1875, -0.5, -0.1875, 0.1875, 0.375, 0.1875},  -- Body
            {-0.0625, 0.375, -0.0625, 0.0625, 0.5, 0.0625},  -- Terminal
        }
    },
    tiles = {"battery_top.png", "battery_side.png"},
    groups = {dig_immediate=2, component=1, power_source=1},
    paramtype = "light",

    on_construct = function(pos)
        local meta = core.get_meta(pos)
        meta:set_string("voltage", "9")  -- 9V battery
        meta:set_int("charge", 100)     -- Percentage
    end,
})

-- Copper Wire
core.register_node("electronics:copper_wire", {
    description = "Copper Wire",
    drawtype = "nodebox",
    node_box = {
        type = "connected",
        fixed = {-0.0625, -0.0625, -0.0625, 0.0625, 0.0625, 0.0625},
        connect_left = {{-0.5, -0.0625, -0.0625, 0.0625, 0.0625, 0.0625}},
        connect_right = {{-0.0625, -0.0625, -0.0625, 0.5, 0.0625, 0.0625}},
        connect_front = {{-0.0625, -0.0625, -0.5, 0.0625, 0.0625, 0.0625}},
        connect_back = {{-0.0625, -0.0625, -0.0625, 0.0625, 0.0625, 0.5}},
        connect_bottom = {{-0.0625, -0.5, -0.0625, 0.0625, 0.0625, 0.0625}},
        connect_top = {{-0.0625, -0.0625, -0.0625, 0.0625, 0.5, 0.0625}},
    },
    tiles = {"copper_wire.png"},
    groups = {dig_immediate=2, conductor=1},
    paramtype = "light",
    connects_to = {"group:conductor", "group:component"},
})

-- Breadboard
core.register_node("electronics:breadboard", {
    description = "Breadboard",
    drawtype = "normal",
    tiles = {"breadboard_top.png", "breadboard_side.png"},
    groups = {dig_immediate=2, breadboard=1},
    paramtype = "light",

    on_construct = function(pos)
        local meta = core.get_meta(pos)
        -- Store connections
        local connections = {}
        for row = 1, 30 do
            for col = 1, 10 do
                local key = row .. "_" .. col
                connections[key] = ""  -- Empty or component name
            end
        end
        meta:set_string("connections", core.write_json(connections))
    end,
})
```

### 13.2 Circuit Simulation

```lua
-- electronics_circuit.lua
local circuit = {}

-- ABM to update circuit state
core.register_abm({
    label = "Circuit simulation",
    nodenames = {"group:component"},
    interval = 0.1,
    chance = 1,

    action = function(pos, node, active_object_count, active_object_count_wider)
        update_circuit(pos)
    end,
})

function update_circuit(start_pos)
    -- Perform circuit analysis starting from start_pos
    local visited = {}
    local queue = {start_pos}

    while #queue > 0 do
        local pos = table.remove(queue, 1)
        local key = core.pos_to_string(pos)

        if visited[key] then goto continue end
        visited[key] = true

        local node = core.get_node(pos)
        local nodedef = core.registered_nodes[node.name]

        if nodedef and nodedef.groups.component then
            -- Get connected components
            local connected = get_connected_components(pos)

            -- Calculate power state
            local powered = calculate_power(pos, connected)

            -- Update component state
            update_component_state(pos, powered)

            -- Add neighbors to queue
            for _, conn_pos in ipairs(connected) do
                table.insert(queue, conn_pos)
            end
        end

        ::continue::
    end
end

function get_connected_components(pos)
    local connected = {}
    local node = core.get_node(pos)
    local dirs = {
        vector.new(1, 0, 0),
        vector.new(-1, 0, 0),
        vector.new(0, 0, 1),
        vector.new(0, 0, -1),
        vector.new(0, 1, 0),
        vector.new(0, -1, 0),
    }

    for _, dir in ipairs(dirs) do
        local check_pos = vector.add(pos, dir)
        local check_node = core.get_node(check_pos)

        -- Check if connected via wire or directly
        if core.get_item_group(check_node.name, "conductor") > 0 or
           core.get_item_group(check_node.name, "component") > 0 then
            table.insert(connected, check_pos)
        end
    end

    return connected
end

function calculate_power(pos, connected)
    -- Check if connected to power source
    local has_power = false
    local voltage = 0

    for _, conn_pos in ipairs(connected) do
        local conn_node = core.get_node(conn_pos)
        if core.get_item_group(conn_node.name, "power_source") > 0 then
            has_power = true
            local meta = core.get_meta(conn_pos)
            voltage = tonumber(meta:get_string("voltage") or "0")
            break
        end
    end

    if not has_power then
        return {powered = false, voltage = 0, current = 0}
    end

    -- Calculate circuit resistance
    local total_resistance = calculate_total_resistance(pos, connected)

    -- Calculate current (Ohm's law: I = V/R)
    local current = voltage / total_resistance

    return {powered = true, voltage = voltage, current = current}
end

function calculate_total_resistance(pos, connected)
    local resistance = 0

    for _, conn_pos in ipairs(connected) do
        local conn_node = core.get_node(conn_pos)
        local nodedef = core.registered_nodes[conn_node.name]

        if nodedef and nodedef.groups.component then
            local meta = core.get_meta(conn_pos)
            local r = tonumber(meta:get_string("resistance") or "0")
            resistance = resistance + r
        end
    end

    -- Wire resistance (small)
    resistance = resistance + (#connected * 0.01)

    return resistance
end

function update_component_state(pos, power)
    local node = core.get_node(pos)
    local meta = core.get_meta(pos)

    if node.name == "electronics:led" then
        if power.powered and power.current > 0.02 then  -- 20mA threshold
            meta:set_int("state", 1)
            -- Update texture to be bright
            local color = meta:get_string("color")
            local new_node = {name = node.name, param1 = node.param1, param2 = node.param2}
            core.swap_node(pos, new_node)

            -- Turn on light
            core.add_node({x=pos.x, y=pos.y+1, z=pos.z},
                {name="electronics:light_source"})
        else
            meta:set_int("state", 0)
        end
    end
end
```

### 13.3 Crafting Recipes

```lua
-- electronics_crafting.lua

-- Soldering tool
core.register_tool("electronics:soldering_iron", {
    description = "Soldering Iron",
    inventory_image = "soldering_iron.png",
    tool_capabilities = {
        max_drop_level = 0,
        groupcaps = {}
    },
})

-- Crafting recipes
core.register_craft({
    output = "electronics:resistor 4",
    recipe = {
        {"default:coal_lump", "default:steel_ingot", "default:coal_lump"},
        {"", "default:steel_ingot", ""},
    }
})

core.register_craft({
    output = "electronics:capacitor 2",
    recipe = {
        {"electronics:copper_wire", "default:paper", "electronics:copper_wire"},
        {"electronics:copper_wire", "default:paper", "electronics:copper_wire"},
    }
})

core.register_craft({
    output = "electronics:led",
    recipe = {
        {"dye:red", "default:mese_crystal_fragment", "group:conductor"},
        {"", "group:conductor", ""},
    }
})

core.register_craft({
    output = "electronics:battery",
    recipe = {
        {"default:steel_ingot", "default:coal_lump", "default:steel_ingot"},
        {"default:steel_ingot", "default:coal_lump", "default:steel_ingot"},
        {"electronics:copper_wire", "", "electronics:copper_wire"},
    }
})

core.register_craft({
    output = "electronics:copper_wire 12",
    recipe = {
        {"default:copper_ingot", "", ""},
        {"", "default:copper_ingot", ""},
        {"", "", "default:copper_ingot"},
    }
})

core.register_craft({
    output = "electronics:soldering_iron",
    recipe = {
        {"default:steel_ingot", "", "default:steel_ingot"},
        {"", "default:torch", ""},
        {"", "default:stick", ""},
    }
})

-- Cooking recipes (for circuit board fabrication)
core.register_craft({
    type = "cooking",
    output = "electronics:pcb_board",
    recipe = "default:glass",
    cooktime = 10,
})
```

---

## 14. Code Examples

### 14.1 Basic Node Registration

```lua
-- Basic node
core.register_node("mymod:stone", {
    description = "My Stone",
    tiles = {"mymod_stone.png"},
    groups = {cracky = 3, stone = 1},
})

-- Node with custom callbacks
core.register_node("mymod:interactive", {
    description = "Interactive Block",
    tiles = {"mymod_interactive.png"},

    on_construct = function(pos)
        -- Called when block placed
        local meta = core.get_meta(pos)
        meta:set_string("info", "This block can be used!")
    end,

    on_destruct = function(pos)
        -- Called before block removed
    end,

    on_rightclick = function(pos, node, clicker, itemstack, pointed_thing)
        -- Show formspec or do something
        core.show_formspec(clicker:get_player_name(), "mymod:form",
            "size[4,3]label[1,1;Hello from right click!]")
    end,

    on_punch = function(pos, node, puncher, pointed_thing)
        -- Called when punched
        core.chat_send_player(puncher:get_player_name(), "You punched me!")
    end,

    on_timer = function(pos, elapsed)
        -- Called when timer expires
        return false  -- Don't repeat
    end,
})
```

### 14.2 ABM (Active Block Modifier)

```lua
-- Simple ABM
core.register_abm({
    label = "Grow grass",
    nodenames = {"default:dirt"},
    neighbors = {"air"},
    interval = 10,  -- Run every 10 seconds
    chance = 20,    -- 1 in 20 chance per block

    action = function(pos, node, active_object_count, active_object_count_wider)
        local above = {x = pos.x, y = pos.y + 1, z = pos.z}
        if core.get_node(above).name == "air" then
            core.set_node(pos, {name = "default:dirt_with_grass"})
        end
    end,
})

-- Complex ABM with condition checking
core.register_abm({
    label = "Spread fire",
    nodenames = {"fire:basic_flame"},
    neighbors = {"group:flammable"},
    interval = 5,
    chance = 2,

    action = function(pos, node, active_object_count, active_object_count_wider)
        -- Find flammable neighbors
        local neighbors = core.find_nodes_in_area(
            {x = pos.x - 1, y = pos.y - 1, z = pos.z - 1},
            {x = pos.x + 1, y = pos.y + 1, z = pos.z + 1},
            {"group:flammable"}
        )

        for _, npos in ipairs(neighbors) do
            if math.random() < 0.3 then  -- 30% chance to spread
                core.set_node(npos, {name = "fire:basic_flame"})
            end
        end
    end,
})
```

### 14.3 LBM (Loading Block Modifier)

```lua
-- Runs once when block is loaded from disk
core.register_lbm({
    label = "Update old blocks",
    name = "mymod:update_old_blocks",

    nodenames = {"mymod:old_block"},

    action = function(pos, node)
        -- Update old block to new version
        core.swap_node(pos, {name = "mymod:new_block"})
    end,

    -- Optional: run on specific blocks only
    run_at_every_load = false,
})
```

### 14.4 Formspec UI

```lua
-- Simple formspec
local function show_simple_formspec(player)
    core.show_formspec(player:get_player_name(), "mymod:form",
        "size[6,4]" ..
        "label[0.5,0.5;This is a formspec]" ..
        "field[0.5,1.5;5,1;name;Name;]" ..
        "button_exit[2,3;2,1;exit;Close]"
    )
end

-- Complex formspec with tabs and lists
local function show_complex_formspec(player)
    local formspec = [[
        size[10,8]
        tabheader[0,0;10,0.8;tabs;Inventory,Settings,Info;1]

        -- Inventory tab
        list[context:playername;main;0,1;3,3;]
        list[context:playername;craft;4,1;3,3;]
        list[current_player;main;0,5;10,1;]

        -- Settings tab
        container[0,0]
        checkbox[0.5,1;setting1;Enable Feature;true]
        dropdown[0.5,2;5;option;Option A,Option B,Option C;1]
        field[0.5,3;5,1;input;Input Value;]
        container_end[]
    ]]

    core.show_formspec(player:get_player_name(), "mymod:complex", formspec)
end

-- Handle formspec input
core.register_on_player_receive_fields(function(player, formname, fields)
    if formname == "mymod:form" then
        if fields.quit then
            -- Handle close/exit
        elseif fields.name then
            core.chat_send_player(player:get_player_name(),
                "Hello, " .. fields.name .. "!")
        end
    elseif formname == "mymod:complex" then
        if fields.setting1 then
            local enabled = core.is_yes(fields.setting1)
            -- Save setting
        end
    end
end)
```

### 14.5 Chat Commands

```lua
-- Simple command
core.register_chatcommand("hello", {
    params = "",
    description = "Say hello",
    privs = {},
    func = function(name, param)
        return true, "Hello, " .. name .. "!"
    end,
})

-- Command with parameters
core.register_chatcommand("teleport", {
    params = "<x> <y> <z>",
    description = "Teleport to coordinates",
    privs = {teleport = true},
    func = function(name, param)
        local x, y, z = param:match("^(%d+)%s+(%d+)%s+(%d+)$")
        if not x then
            return false, "Invalid coordinates. Use: /teleport <x> <y> <z>"
        end

        local player = core.get_player_by_name(name)
        if player then
            player:set_pos({x = tonumber(x), y = tonumber(y), z = tonumber(z)})
            return true, "Teleported to " .. x .. "," .. y .. "," .. z
        end
    end,
})
```

### 14.6 HUD Elements

```lua
-- Add HUD element
local function add_hud(player)
    local hud_id = player:hud_add({
        hud_elem_type = "image",
        position = {x = 0.5, y = 0.5},
        scale = {x = -100, y = -100},  -- Negative means use texture size
        text = "my_image.png",
        alignment = {x = 0, y = 0},
        offset = {x = 0, y = 0},
    })

    -- Store ID for later removal
    player:get_meta():set_int("my_hud_id", hud_id)
end

-- Add progress bar HUD
local function add_progress_bar(player, percent)
    player:hud_add({
        hud_elem_type = "statbar",
        position = {x = 0.5, y = 0.5},
        text = "my_progress_bar.png",
        number = 20,  -- Max value
        item = percent,  -- Current value
        direction = 0,  -- Horizontal
        offset = {x = 0, y = -50},
    })
end

-- Remove HUD element
local function remove_hud(player)
    local hud_id = player:get_meta():get_int("my_hud_id")
    if hud_id > 0 then
        player:hud_remove(hud_id)
    end
end
```

---

## 15. Mod Development Guide

### 15.1 Mod Structure

```
mymod/
├── init.lua           -- Main mod file
├── mod.conf           -- Mod metadata
├── license.txt        -- License
├── readme.md          -- Documentation
├── textures/          -- Textures
│   ├── mymod_node.png
│   └── mymod_item.png
├── sounds/            -- Sounds
│   └── mymod_sound.ogg
├── models/            -- 3D models
│   └── mymod_entity.b3d
├── locale/            -- Translations
│   └── mymod.fr.tr
└── scripts/           -- Additional Lua files
    ├── api.lua
    └── nodes.lua
```

### 15.2 mod.conf

```ini
name = mymod
description = My awesome mod
depends = default, another_mod
optional_depends = optional_mod
```

### 15.3 Best Practices

1. **Namespace everything:**
   ```lua
   -- Use modname: prefix for all registered items
   core.register_node("mymod:node", {...})
   ```

2. **Use groups:**
   ```lua
   core.register_node("mymod:stone", {
       groups = {cracky = 3, stone = 1, mymod_custom = 2},
   })
   ```

3. **Handle player leave:**
   ```lua
   core.register_on_leaveplayer(function(player, timed_out)
       -- Clean up player data
   end)
   ```

4. **Use metadata sparingly:**
   ```lua
   -- Prefer mod storage over node metadata when possible
   local storage = core.get_mod_storage()
   ```

5. **Add privs if needed:**
   ```lua
   core.register_privilege("mymod_priv", {
       description = "Allows using mymod features",
       give_to_singleplayer = true,
   })
   ```

6. **Support translation:**
   ```lua
   local S = core.get_translator("mymod")
   core.register_node("mymod:node", {
       description = S("My Node"),
   })
   ```

---

## Appendix A: API Quick Reference

### Environment
- `core.get_node(pos)` -> node
- `core.set_node(pos, node)`
- `core.add_entity(pos, name)` -> ObjectRef
- `core.get_player_by_name(name)` -> ObjectRef

### Map Manipulation
- `core.load_area(p1, p2)`
- `core.emerge_area(p1, p2, callback)`
- `core.delete_area(p1, p2)`
- `core.fix_light(p1, p2)`

### Mapgen
- `core.get_mapgen_params()` -> params
- `core.register_biome(def)`
- `core.register_decoration(def)`
- `core.register_ore(def)`

### Callbacks
- `core.register_on_generated(func(minp, maxp, blockseed))`
- `core.register_on_newplayer(func(player))`
- `core.register_on_chat_message(func(name, message))`
- `core.register_globalstep(func(dtime))`

### Item Registration
- `core.register_item(name, def)`
- `core.register_node(name, def)`
- `core.register_craftitem(name, def)`
- `core.register_tool(name, def)`

### Entity Registration
- `core.register_entity(name, def)`

### Modifiers
- `core.register_abm(def)`
- `core.register_lbm(def)`

### Chat Commands
- `core.register_chatcommand(name, def)`

### HUD
- `player:hud_add(def)` -> id
- `player:hud_remove(id)`
- `player:hud_change(id, stat, value)`

---

## Appendix B: Integration Checklist

### For StudyLoG.AI

- [ ] Create custom mapgen for educational worlds
- [ ] Register AI tutor entities
- [ ] Implement backend communication (HTTP/mod channels)
- [ ] Add progress tracking system
- [ ] Create electronics-themed nodes
- [ ] Implement circuit simulation
- [ ] Add crafting recipes
- [ ] Create tutorial system
- [ ] Implement achievement system
- [ ] Add student analytics

### For DMLoG.AI

- [ ] Create dungeon generation system
- [ ] Implement ranch animal behaviors
- [ ] Add fishing mechanics
- [ ] Create encounter system
- [ ] Implement loot tables
- [ ] Add monster AI
- [ ] Create quest system
- [ ] Implement save/load for campaigns
- [ ] Add party system
- [ ] Create combat mechanics

---

## Appendix C: File Locations (Absolute Paths)

- **Repository:** `/mnt/c/cognitivemill/studylog-github/luanti/`
- **Source:** `/mnt/c/cognitivemill/studylog-github/luanti/src/`
- **Headers:** `/mnt/c/cognitivemill/studylog-github/luanti/src/*.h`
- **Lua API:** `/mnt/c/cognitivemill/studylog-github/luanti/src/script/lua_api/`
- **Builtin:** `/mnt/c/cognitivemill/studylog-github/luanti/builtin/`
- **Devtest:** `/mnt/c/cognitivemill/studylog-github/luanti/games/devtest/`
- **Documentation:** `/mnt/c/cognitivemill/studylog-github/luanti/doc/`

---

## Appendix D: Advanced Topics

### D.1 Physics System

Luanti uses a custom physics system optimized for voxel worlds:

```cpp
// From src/collision.h
// Collision detection uses raycasting and AABB intersection
// for fast voxel-aware physics

bool collisionMoveSimple(Map *map, IGameDef *gamedef,
    f32 pos_max_d, f32 stepheight, f32 stepheight_down,
    v3f *pos_f, v3f *pos_f_up, v3f *speed);
```

**Key Physics Features:**
- **AABB Collision:** Axis-aligned bounding box for fast collision
- **Raycasting:** For shooting, line-of-sight, and selection
- **Liquid Physics:** Flowing liquid simulation
- **Node Metadata:** Per-node custom collision boxes

### D.2 Lighting System

Luanti uses a two-bank lighting system:

```cpp
// Light banks
enum LightBank {
    LIGHTBANK_DAY,    // Sunlight
    LIGHTBANK_NIGHT   // Artificial light
};

// Each node can have light from 0-15
// Stored in param1 for legacy nodes
// Light propagates through transparent nodes
```

**Light Propagation:**
1. **Sunlight:** Spreads downward from surface
2. **Artificial Light:** Spreads in all directions from light sources
3. **Sunlight Caching:** Stored per-block for performance
4. **Deferred Updates:** Light updates when blocks change

### D.3 Client-Server Synchronization

**State Synchronization:**

```cpp
// From src/network/clientopcodes.h
// Client sends position, interaction, and chat
// Server sends block data, entities, and world changes

// Interpolation for smooth movement:
// Client predicts and corrects based on server updates
```

**Bandwidth Optimization:**
- Block changes sent incrementally
- Entity updates batched
- Media cached on client
- Zstd compression for bulk data

### D.4 Mod Storage Internals

Mod storage uses SQLite by default:

```sql
CREATE TABLE IF NOT EXISTS `mod_storage` (
    `modname` VARCHAR(32) NOT NULL PRIMARY KEY,
    `value` BLOB
);

-- Data stored as serialized key-value pairs
-- Deserialized into StringMap on load
```

### D.5 Privilege System

Built-in privileges:

| Privilege | Description |
|-----------|-------------|
| interact | Basic interaction |
| shout | Chat |
| fly | Fly mode |
| fast | Fast mode |
| noclip | Walk through walls |
| teleport | Teleport command |
| bring | Bring players |
| give | Give items |
| settime | Change time |
| server | Server commands |

Custom privileges can be registered:

```lua
core.register_privilege("mypriv", {
    description = "My custom privilege",
    give_to_singleplayer = true,
    give_to_admin = true,
})
```

### D.6 Entity Attachment System

Entities can be attached to other entities:

```lua
-- Attach entity to player
entity:set_attach(player, "", {x=0, y=0, z=0})

-- Detach
entity:set_detach()

-- Get attachment parent
local parent = entity:get_attach()
```

**Use Cases:**
- Held items
- Mounted vehicles
- Carried objects
- Player armor

### D.7 Particle System

Advanced particle effects:

```lua
core.add_particle({
    pos = {x=0, y=10, z=0},
    velocity = {x=0, y=-1, z=0},
    acceleration = {x=0, y=0, z=0},
    expirationtime = 5,
    size = 1,
    collisiondetection = true,
    collision_removal = true,
    texture = "particle.png",
    vertical = false,
    glow = 0,
})
```

**Particle Spawner:**

```lua
core.add_particlespawner({
    amount = 10,
    time = 1,
    minpos = {x=-1, y=0, z=-1},
    maxpos = {x=1, y=1, z=1},
    minvel = {x=0, y=-1, z=0},
    maxvel = {x=0, y=1, z=0},
    minexptime = 1,
    maxexptime = 3,
    size = 1,
    texture = "particle.png",
})
```

### D.8 HTTP API

The built-in HTTP API allows mods to make web requests:

```lua
local http = core.request_http_api()

-- GET request
http.fetch({url = "https://api.example.com/data"}, function(result)
    if result.succeeded then
        local data = core.parse_json(result.data)
        -- Process data
    end
end)

-- POST request
http.fetch({
    url = "https://api.example.com/post",
    post_data = core.write_json({key = "value"}),
    method = "POST",
    extra_headers = {
        "Content-Type: application/json",
    }
}, callback)
```

**For backend integration:**
- Use for AI model requests
- Progress synchronization
- Asset catalog queries
- Student authentication

### D.9 Texture Modifiers

Dynamic texture modification:

```lua
-- Apply colorize modifier
entity:set_texture_mod("[colorize:#FF0000:255")

-- Apply overlay
entity:set_texture_mod("^overlay.png")

-- Combine modifiers
entity:set_texture_mod("[colorize:#00FF00:128]^overlay.png")
```

### D.10 Node Timers

Nodes can have scheduled actions:

```lua
core.register_node("mymod:delayed", {
    on_construct = function(pos)
        local timer = core.get_node_timer(pos)
        timer:start(10, 0)  -- 10 seconds, no data
    end,

    on_timer = function(pos, elapsed)
        -- Called when timer expires
        return false  -- Don't repeat
    end,
})

-- Also works with ABM-triggered timers
```

---

## Appendix E: Lua API Comprehensive Reference

### E.1 Core Functions

#### Utility Functions

```lua
-- Logging
core.log(level, text)
-- level: "none", "error", "warning", "action", "info", "verbose"

-- Time
core.get_us_time()  -- Microseconds

-- Random
core.get_seed()  -- Random seed based on position

-- String utilities
string.split(str, separator, include_empty, max_splits, sep_is_pattern)
string:trim()
string.split(separator, include_empty, max_splits, sep_is_pattern)

-- Table utilities
table.copy(table)  -- Deep copy
table.indexof(list, val)  -- Find index

-- Math utilities
math.hypot(x, y)  -- Hypotenuse
math.sign(x, tolerance)  -- Sign with tolerance
```

#### Chat Commands

```lua
core.register_chatcommand(name, {
    params = "<param>",
    description = "Description",
    privs = {priv1 = true},
    func = function(player_name, param)
        return true, "Response message"
    end,
})

core.unregister_chatcommand(name)
core.registered_chatcommands[name]
```

#### Privileges

```lua
core.register_privilege(name, {
    description = "Description",
    give_to_singleplayer = true,
    give_to_admin = true,
    on_grant = function(name, granter_name)
        -- Called when privilege granted
    end,
    on_revoke = function(name, revoker_name)
        -- Called when privilege revoked
    end,
})

core.get_privileges()
core.get_player_privs(name) -> {priv = true, ...}
```

### E.2 Player API

```lua
-- Position and movement
player:set_pos(pos)
player:get_pos() -> pos
player:set_velocity(vel)
player:get_velocity() -> vel
player:add_player_velocity(vel)
player:set_look_horizontal(yaw)
player:set_look_vertical(pitch)
player:get_look_dir() -> vector

-- HP and breath
player:set_hp(hp, reason)
player:get_hp() -> hp
player:set_breath(breath)
player:get_breath() -> breath

-- Inventory
player:get_inventory() -> InvRef
player:get_wield_index() -> index
player:get_wielded_item() -> ItemStack
player:set_wielded_item(item)

-- Attributes
player:set_attribute(key, value)
player:get_attribute(key) -> value

-- Formspec
player:set_formspec_prepend(formspec)
player:set_inventory_formspec(formspec)

-- Movement controls
player:set_physics_override(overrides)
player:get_physics_override() -> overrides
-- overrides: {speed, jump, gravity, sneak, sneak_glitch, new_move}

-- HUD
player:hud_add(def) -> id
player:hud_remove(id)
player:hud_change(id, stat, value)
player:hud_get_flags() -> flags
player:hud_set_flags(flags)

-- Animation
player:set_animation(animation)
player:set_animation_frame_speed(speed)
player:get_animation() -> animation

-- Sky
player:set_sky(sky_params)
player:get_sky() -> sky_params

-- Clouds
player:set_clouds(params)
player:get_clouds() -> params

-- Day/night
player:set_day_night_ratio(ratio)
player:get_day_night_ratio() -> ratio

-- Lighting
player:set_lighting(lighting_params)
player:get_lighting() -> lighting_params
```

### E.3 ItemStack API

```lua
-- Creation
ItemStack(itemstring_or_itemstring_or_table or ItemStack or nil)
ItemStack:isEmpty() -> boolean
ItemStack:get_name() -> string
ItemStack:get_count() -> number
ItemStack:get_wear() -> number
ItemStack:get_metadata() -> string

-- Modification
item:set_count(count)
item:take_item(count) -> taken
item:add_item(other) -> leftover

-- Wear (for tools)
item:add_wear(amount)
item:get_wear() -> number
item:get_max_wear() -> number

-- Comparison
item:is_known() -> boolean
item:to_string() -> string
item:to_table() -> table

-- Stack functions
item:get_definition() -> itemdef
item:get_tools_breaking_level(tool_name) -> number or 0
item:wear_out(count) -- Returns leftover ItemStack
```

### E.4 Inventory API

```lua
-- Get inventory
inv = player:get_inventory()
inv = core.get_inventory(location)

-- Lists
inv:get_size(listname) -> size
inv:set_size(listname, size)
inv:get_list(listname) -> {ItemStack, ...}
inv:set_list(listname, {ItemStack, ...})
inv:get_stack(listname, index) -> ItemStack
inv:set_stack(listname, index, ItemStack)

-- Manipulation
inv:add_item(listname, ItemStack) -> leftover
inv:room_for_item(listname, ItemStack) -> boolean
inv:contains_item(listname, itemname) -> boolean
inv:remove_item(listname, ItemStack) -> taken

-- Width
inv:get_width(listname) -> width
inv:set_width(listname, width)
```

### E.5 MetaData Ref

```lua
-- Get metadata
meta = core.get_meta(pos)

-- String operations
meta:set_string(key, value)
meta:get_string(key) -> value
meta:get_string(key, default) -> value

-- Int operations
meta:set_int(key, value)
meta:get_int(key) -> value
meta:get_int(key, default) -> value

-- Float operations
meta:set_float(key, value)
meta:get_float(key) -> value
meta:get_float(key, default) -> value

-- Inventory
meta:get_inventory() -> InvRef

-- Mark as changed
meta:mark_as_dirty()

-- Contains
meta:contains(key) -> boolean
meta:get_keys() -> {key, ...}

-- To table (for complex data)
meta:to_table() -> table or nil
meta:from_table(table)
```

### E.6 NodeTimer Ref

```lua
timer = core.get_node_timer(pos)

-- Start timer
timer:start(timeout, elapsed)
timer:set(timeout, elapsed)

-- Stop
timer:stop()

-- Get state
timer:get_timeout() -> timeout
timer:get_elapsed() -> elapsed
timer:is_started() -> boolean
```

### E.7 ObjectRef (Entities)

```lua
-- Common operations
object:remove()
object:get_pos() -> pos
object:set_pos(pos)
object:move_to(pos, continuous)
object:punch(puncher, time_from_last_punch, tool_capabilities, dir)

-- Lua entity specific
object:set_velocity(vel)
object:get_velocity() -> vel
object:set_acceleration(acc)
object:get_acceleration() -> acc
object:set_yaw(yaw)
object:get_yaw() -> yaw
object:set_texture_mod(mod)
object:set_sprite(frame, num_frames, framelength, select_horiz_by_yawpitch)
object:set_properties(prop)
object:get_properties() -> prop
object:set_armor_groups(groups)
object:get_armor_groups() -> groups

-- Animation
object:set_animation(frame_range, frame_speed, frame_blend, frame_loop)
object:get_animation() -> frame_range, frame_speed, frame_blend, frame_loop
object:set_animation_speed(speed)
object:set_bone_position(bone, position, rotation)
object:get_bone_position(bone) -> position, rotation

-- Attach
object:set_attach(parent, bone, position, rotation)
object:get_attach_parent() -> ObjectRef or nil
object:set_detach()
object:get_children() -> {ObjectRef, ...}

-- HP
object:set_hp(hp, reason)
object:get_hp() -> hp

-- Name
object:get_nametag_attributes() -> attributes
object:set_nametag_attributes(attributes)

-- HUD
object:hud_add(...) -- Player only
object:hud_remove(...) -- Player only

-- Misc
object:move_to(env, pos) -- Move to another environment
object:get_luaentity() -- Get LuaEntitySAO (server only)
```

### E.8 VoxelManipulator

```lua
-- Create
vm = core.get_voxel_manip()
vm = core.get_voxel_manip(minp, maxp)

-- Read/write
vm:read_from_map(minp, maxp) -> emin, emax
vm:write_to_map(lighting)

-- Data access
vm:get_data() -> array
vm:set_data(array)
vm:get_node_at(pos) -> node
vm:set_node_at(pos, node)

-- Modification
vm:update_map()
vm:update_liquids()
vm:calc_lighting()
vm:set_lighting(light)

-- Content
vm:get_content() -> content_id
vm:get_param2_data() -> array
vm:get_param2_data(pos) -> array
vm:set_param2_data(pos, array)
```

### E.9 PerlinNoise

```lua
noise = core.get_perlin_noise({
    offset = {x=0, y=0, z=0},
    scale = {x=100, y=100, z=100},
    spread = {x=500, y=500, z=500},
    seed = 1234,
    octaves = 3,
    persistence = 0.5,
    lacunarity = 2.0,
    flags = "defaults",
})

-- 2D noise
noise2d = core.get_perlin_noise({
    offset = {x=0, y=0},
    scale = {x=100, y=100},
    spread = {x=500, y=500},
    seed = 1234,
    octaves = 3,
    persistence = 0.5,
    lacunarity = 2.0,
})

-- Get noise value
val = noise:get_3d_noise(x, y, z)
val2d = noise2d:get_2d_noise(x, y)
```

### E.10 Settings API

```lua
-- Get/set
core.settings:get(key) -> value or ""
core.settings:get_bool(key) -> boolean
core.settings:set(key, value)
core.settings:set_bool(key, boolean)
core.settings:remove(key)

-- Get all
core.settings:get_names() -> {key, ...}

-- Write to file
core.settings:write()

-- Flag types
core.settings:get_flag(key) -> "flags", "noise_params", "float", etc.
```

---

## Appendix F: Debugging and Profiling

### F.1 Debug Tools

```lua
-- Profiler
core.profiler_begin()
-- ... code to profile ...
core.profiler_end()

-- Print table
core.debug(dump(obj, name))

-- Get info
debug.getinfo(level)
debug.getlocal(level, index)

-- Traceback
debug.traceback()

-- Performance counters
core.get_perlin_modified_blocks() -> count
```

### F.2 Profiling Commands

In-game chat commands for profiling:

```
/profiler [print]      -- Start profiler, optional print
/profiler [print]      -- Stop profiler and print results
/particleprofiler      -- Profile particle spawning
/rollback_check        -- Check rollback consistency
/time <seconds>        -- Set time speed (0=pause)
```

### F.3 Logging Best Practices

```lua
-- Use appropriate log levels
core.log("error", "Critical error: " .. err)
core.log("warning", "Warning: " .. warn)
core.log("action", "Player " .. name .. " did action")
core.log("info", "Info message")
core.log("verbose", "Detailed debug info")

-- For debugging specific features
local mymod_log = core.settings:get_bool("mymod_debug") and
    function(msg) core.log("verbose", "[mymod] " .. msg) or
    function() end
```

---

## Appendix G: Multiplayer Architecture

### G.1 Server Lifecycle

```
Server Startup
    ↓
Load Configuration
    ↓
Initialize Database
    ↓
Load Mods (in dependency order)
    ↓
Load World
    ↓
Start Server Thread
    ↓
Listen for Connections
```

### G.2 Client Connection Flow

```
Client Start
    ↓
Connect to Server
    ↓
TOSERVER_INIT (protocol versions)
    ↓
TOCLIENT_HELLO (serialization, auth methods)
    ↓
TOSERVER_INIT2 (ack)
    ↓
TOCLIENT_AUTH_ACCEPT (or TOCLIENT_DENY_SUDO_MODE)
    ↓
TOSERVER_INIT2 (ack)
    ↓
TOSERVER_REQUEST_MEDIA (missing media)
    ↓
TOCLIENT_MEDIA (media files)
    ↓
TOSERVER_CLIENT_READY (ready to play)
    ↓
TOCLIENT_BLOCKDATA (initial blocks)
    ↓
Game Loop
```

### G.3 Client Prediction

The client predicts player movement for responsiveness:

```lua
-- Client-side (if CSM allowed)
core.register_on_step(function(dtime)
    local player = core.localplayer
    local vel = player:get_velocity()
    local pos = player:get_pos()

    -- Predict next position
    local next_pos = vector.add(pos, vector.multiply(vel, dtime))

    -- Send to server for correction if needed
end)
```

Server corrects client with `TOCLIENT_MOVE_PLAYER_REL` when prediction is wrong.

### G.4 Bandwidth Management

Active block management limits data transfer:

```cpp
// From src/server.cpp
// Server only sends blocks within active range
// Active range = mapblock view distance + generation range

// Block updates are batched per step
// Entity updates prioritized by distance
// Media sent separately and cached
```

---

## Appendix H: Formspec Complete Reference

### H.1 Formspec Elements

```
size[W,H]                     -- Container size
position[X,Y]                  -- Position
anchor[corner]                 -- Anchor (nw, ne, sw, se, n, e, s, center, c)
padding[padding]              -- Inner spacing
no_prepend[]                   -- Disable global prepend

-- Background
bgcolor[navy;blue;purple;0xFF00FF]

-- Tabs
tabheader[X,Y;W,H;name;caption1,caption2,...;selected_index]

-- Lists
list[current_player;main;X,Y;W,H;]
list[context:playername;main;X,Y;W,H;p1,p2;]

-- Fields
field[X,Y;W,H;name;label;default]
field_close_on_enter[name;close]
pwdfield[X,Y;W,H;name;label]
textarea[X,Y;W,H;name;label;default]

-- Dropdowns
dropdown[X,Y;W,H;name;item1,item2,...;selected_idx]
dropdown[values]text

-- Checkboxes
checkbox[X,Y;name;label;selected]

-- Buttons
button[X,Y;W,H;name;label]
button_exit[X,Y;W,H;name;label]
image_button[X,Y;W,H;name;label]
image_button_exit[X,Y;W,H;name;label]
item_image_button[X,Y;W,H;itemname;label]

-- Scrollbars
scrollbar[X,Y;W,H;orientation;name;max]
scrollbaroptions[min|max;arrows;thumb]

-- Tables
tablecolumns[color;tree;color;text,image,text;inline;color]
table[X,Y;W,H;name;1,2,3]
tableoptions[highlight=#FF0000]

-- Text
label[X,Y;label;color]
textarea[X,Y;W,H;name;color]
vertlabel[X,Y;label]

-- Images
image[X,Y;W,H;filename]
image[X,Y;W,H;filename;name1,name2,...]
image[X,Y;X2,Y2;filename]
item_image[X,Y;W,H;itemname]

-- Boxes
box[X,Y;W,H;color]

-- Backgrounds
background[X,Y;W,H;filename;false]
background[0,0;10,5;filename;true]

-- Style
style_type[label;prop=value;prop=value;...]
style_type[button;border=false;bgcolor=#484848]
```

### H.2 Color/Position Escapes

```
#RRGGBB                   -- Hex color (red, green, blue)
colorname                  -- Named color (CSS colors)
escape sequence           -- \[colorname:escaped text]

-- Position escapes
${X} ${Y} ${Z}            -- Formspec position variables
```

### H.3 Hypertext/Commands

```
button[8,0;3,0;url_action;URL]
button[8,1;3,0;quit_action;Quit]

-- Built-in actions:
url_open                  -- Open URL in browser
quit                      -- Close formspec
```

---

## Appendix I: Common Mod Patterns

### I.1 Configuration Storage

```lua
local modname = core.get_current_modname()
local modpath = core.get_modpath(modname)
local worldpath = core.get_worldpath()

-- Settings file
local settings_file = worldpath .. "/" .. modname .. "_settings.txt"

local function load_settings()
    local file = io.open(settings_file, "r")
    if not file then return {} end

    local data = file:read("*all")
    file:close()

    return core.parse_json(data) or {}
end

local function save_settings(data)
    local file = io.open(settings_file, "w")
    if not file then return false end

    file:write(core.write_json(data))
    file:close()
    return true
end
```

### I.2 Persistent Data

```lua
local storage = core.get_mod_storage()

local data = {}
local default_data = {
    players = {},
    config = {},
}

local function load()
    local raw = storage:get_string("data")
    if raw == "" then
        data = default_data
        save()
    else
        data = core.parse_json(raw) or default_data
    end
end

local function save()
    storage:set_string("data", core.write_json(data))
end

local function get_player_data(player_name)
    load()
    data.players[player_name] = data.players[player_name] or {}
    return data.players[player_name]
end

local function set_player_data(player_name, key, value)
    local pd = get_player_data(player_name)
    pd[key] = value
    save()
end
```

### I.3 Area Protection

```lua
local areas = {}

function add_area(owner, pos1, pos2)
    local id = #areas + 1
    areas[id] = {
        owner = owner,
        pos1 = pos1,
        pos2 = pos2,
        open = false,  -- Can others interact?
    }
    return id
end

function can_interact(player_name, pos)
    for id, area in ipairs(areas) do
        if in_area(pos, area.pos1, area.pos2) then
            return area.owner == player_name or area.open
        end
    end
    return true  -- No protection
end

function in_area(pos, p1, p2)
    return pos.x >= p1.x and pos.x <= p2.x and
           pos.y >= p1.y and pos.y <= p2.y and
           pos.z >= p1.z and pos.z <= p2.z
end
```

### I.4 Simple Economy

```lua
local economy = {}

function economy.get_balance(player_name)
    local storage = core.get_mod_storage()
    local key = "balance:" .. player_name
    return tonumber(storage:get_string(key)) or 0
end

function economy.set_balance(player_name, amount)
    local storage = core.get_mod_storage()
    storage:set_string("balance:" .. player_name, tostring(amount))
end

function economy.add(player_name, amount)
    local current = economy.get_balance(player_name)
    economy.set_balance(player_name, current + amount)
end

function economy deduct(player_name, amount)
    local current = economy.get_balance(player_name)
    if current >= amount then
        economy.set_balance(player_name, current - amount)
        return true
    end
    return false
end

-- Shop node
core.register_node("economy:shop", {
    description = "Shop",
    tiles = {"shop_front.png", "shop_side.png"},
    on_rightclick = function(pos, node, clicker)
        local player_name = clicker:get_player_name()
        show_shop_formspec(player_name, pos)
    end,
})

function show_shop_formspec(player_name, pos)
    local formspec = [[
        size[8,8]
        label[0.5,0.5;Shop - Balance: ]] .. economy.get_balance(player_name) .. [[]
        list[context:playername;main;0,1;8,4;]
        list[current_name;buy;0,5;8,3;]
        button_exit[3,7.5;2,1;buy;Buy Selected]
    ]]
    core.show_formspec(player_name, "economy:shop", formspec)
end
```

### I.5 Spawn Points

```lua
local spawn_points = {}

function add_spawn_point(name, pos)
    table.insert(spawn_points, {name = name, pos = pos})
end

function get_random_spawn_point()
    if #spawn_points == 0 then
        return {x = 0, y = 10, z = 0}
    end
    local sp = spawn_points[math.random(#spawn_points)]
    return sp.pos
end

core.register_on_newplayer(function(player)
    local spawn = get_random_spawn_point()
    player:set_pos(sp)
end)
```

---

## Appendix J: Performance Optimization

### J.1 Block Update Optimization

```lua
-- Batch block updates
local function bulk_set_nodes(nodes)
    local vm = core.get_voxel_manip()

    local changes = {}
    for _, node_data in ipairs(nodes) do
        table.insert(changes, {pos = node_data.pos, node = node_data.node})
    end

    -- Use bulk_set_node if available (newer versions)
    core.bulk_set_node(changes)
end

-- Minimize metadata writes
local function update_meta_efficiently(pos, updates)
    local meta = core.get_meta(pos)
    local changed = false

    for key, value in pairs(updates) do
        if meta:get_string(key) ~= value then
            meta:set_string(key, value)
            changed = true
        end
    end

    if changed then
        meta:mark_as_dirty()
    end
end
```

### J.2 ABM Optimization

```lua
-- Use labels for debugging
core.register_abm({
    label = "my_mod:optimization_example",
    nodenames = {"group:stone"},
    neighbors = {"air"},
    interval = 16,  -- Run less frequently
    chance = 4,     -- 1 in 4 blocks per interval

    -- Optional: check conditions in action
    action = function(pos, node, ac, acw)
        -- Early exit if not needed
        if some_condition(pos) then
            return
        end

        -- Do work
    end,
})
```

### J.3 Entity Optimization

```lua
-- Use static objects for non-moving items
core.register_entity("my_mod:static_item", {
    initial_properties = {
        static_save = true,  -- Save to disk
        physical = false,    -- No physics
    },

    -- Don't step if not needed
    on_step = function(self, dtime)
        if self.needs_update then
            -- Do update
            self.needs_update = false
        end
    end,
})
```

---

## Appendix K: Security Considerations

### K.1 Input Validation

```lua
-- Always validate player input
local function validate_pos(pos_str)
    local pos = core.string_to_pos(pos_str)
    if not pos then
        return nil, "Invalid position"
    end

    -- Check bounds
    if pos.x < -30912 or pos.x > 30912 or
       pos.y < -30912 or pos.y > 30912 or
       pos.z < -30912 or pos.z > 30912 then
        return nil, "Position out of bounds"
    end

    return pos
end
```

### K.2 Privilege Checking

```lua
-- Check privileges before sensitive operations
core.register_chatcommand("admin_action", {
    params = "<action>",
    description = "Perform admin action",
    privs = {privs = true},

    func = function(name, param)
        -- Double-check in action
        if not core.check_player_privs(name, {privs = true}) then
            return false, "You don't have permission"
        end

        -- Perform action
        return true, "Action completed"
    end,
})
```

### K.3 Node Metadata Protection

```lua
-- Use private metadata fields
meta:set_string("key", value, true)  -- private = true

-- Check is_private before reading
local vars = meta:to_table()
for key, var in pairs(vars) do
    if var.is_private and not has_access(player, key) then
        -- Skip private field
    else
        -- Use value
    end
end
```

---

## Appendix L: Troubleshooting

### L.1 Common Issues

**Mod not loading:**
- Check mod.conf for correct dependencies
- Check world.mt for mod being enabled
- Check console for Lua errors

**Blocks not appearing:**
- Verify textures exist
- Check drawtype is appropriate
- Ensure paramtype2 is set if needed

**Entities disappearing:**
- Check static_save is true for persistent entities
- Ensure shouldUnload returns false if needed
- Check that entity is within active block range

### L.2 Debug Commands

```
/lua <code>           -- Run Lua code
/particlespawner       -- List active particle spawners
/delete_blocks p1 p2   -- Delete blocks
/spawnentity <name>    -- Spawn entity at position
/last-login           -- Show last login for players
/pulpit                -- Show/hide pulpit form
```

---

## Conclusion

Luanti provides a robust platform for voxel-based game development with:

1. **Flexible Architecture:** Modular design allows custom mapgens, entities, and behaviors
2. **Rich Lua API:** Comprehensive scripting interface for game logic
3. **Multiplayer Support:** Built-in networking for collaborative experiences
4. **Extensible Backend:** Support for multiple database backends
5. **Active Community:** Well-documented codebase with active development

**Recommended Integration Approach:**

1. Start with Lua mods for rapid prototyping
2. Use custom mapgen for world generation
3. Implement backend communication via HTTP or mod channels
4. Use mod storage for progress tracking
5. Create custom entities for AI agents
6. Consider C++ modules only for performance-critical code

---

**End of Document**

For questions or updates, contact the SuperInstance.AI research team.
