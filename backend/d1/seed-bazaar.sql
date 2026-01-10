-- ═══════════════════════════════════════════════════════════
-- Bazaar Seed Data
-- Sample data for the community marketplace
-- ═══════════════════════════════════════════════════════════

-- Sample users
INSERT OR IGNORE INTO user_profiles (id, student_id, bio, reputation, grain_tokens, creations_shared, forks_made, quality_verifications, created_at, updated_at) VALUES
    ('usr_001', 'student_demo_1', 'Learning AI through simulations', 150, 25, 2, 1, 5, datetime('now', '-30 days'), datetime('now')),
    ('usr_002', 'student_demo_2', 'Godot enthusiast', 75, 10, 1, 0, 2, datetime('now', '-20 days'), datetime('now')),
    ('usr_003', 'teacher_demo', 'STEM educator', 300, 50, 3, 0, 10, datetime('now', '-60 days'), datetime('now'));

-- Sample creations
INSERT OR IGNORE INTO creations (
    id, author_id, title, description, type, millfile, storage_path,
    quality, is_public, forks_count, likes_count, comments_count, downloads_count, created_at, updated_at
) VALUES
-- Puzzle: Basic Circuit Simulation
    (
        'cr_001',
        'usr_001',
        'LED Circuit Simulator',
        'Learn basic circuit principles by building an LED circuit. Includes resistor calculations and voltage drop visualization.',
        'puzzle',
        '[meta]
title = "LED Circuit Simulator"
author = "student_demo_1"
description = "Basic LED circuit with resistor calculator"
quality = 2

[simulation]
components = ["led", "resistor", "battery", "switch"]
difficulty = "beginner"

[ai]
model_used = "claude-3-5-sonnet"
work_ratio = 0.65',
        'simulations/led-circuit/',
        2, 1, 1, 15, 3, 45, datetime('now', '-25 days'), datetime('now', '-5 days')
    ),
-- Simulation: Water Mill
    (
        'cr_002',
        'usr_001',
        'Water Mill Physics',
        'Interactive water mill demonstrating energy conversion from flowing water to rotational mechanical energy.',
        'simulation',
        '[meta]
title = "Water Mill Physics"
author = "student_demo_1"
quality = 3

[simulation]
godot_version = "4.3"
scene = "water_mill.tscn"
components = ["water_wheel", "gears", "grindstone"]

[ai]
model_used = "claude-opus-4-5"
work_ratio = 0.72
verified = true',
        'simulations/water-mill/',
        3, 1, 2, 28, 7, 82, datetime('now', '-20 days'), datetime('now')
    ),
-- Agent: Simple Chat Bot
    (
        'cr_003',
        'usr_002',
        'Tutorial Bot',
        'A helpful AI assistant for the Cognitive Mill stage. Answers questions about circuits and components.',
        'agent',
        '[meta]
title = "Tutorial Bot"
author = "student_demo_2"
quality = 2

[agent]
type = "assistant"
knowledge_base = ["circuits", "components", "physics"]

[ai]
model_used = "claude-3-5-haiku"
work_ratio = 0.80',
        'agents/tutorial-bot/',
        2, 1, 0, 12, 2, 34, datetime('now', '-15 days'), datetime('now')
    ),
-- Extension: Bazaar Widget
    (
        'cr_004',
        'usr_003',
        'Bazaar Community Widget',
        'Theia extension for browsing and sharing community creations. Fork/merge support included.',
        'extension',
        '[meta]
title = "Bazaar Community Widget"
author = "teacher_demo"
description = "Community marketplace for StudyLoG.AI"
quality = 3

[extension]
type = "theia-extension"
features = ["browse", "fork", "like", "comment"]

[permissions]
fork_enabled = true
merge_enabled = true
commercial_use = false',
        'extensions/si-bazaar/',
        3, 1, 3, 45, 12, 128, datetime('now', '-10 days'), datetime('now')
    ),
-- Godot Scene: Fishing Boat
    (
        'cr_005',
        'usr_002',
        'Sitka Sound Fishing Boat',
        'Simple fishing boat for the Sitka Sound ecological simulation. Features basic movement and net casting.',
        'godot-scene',
        '[meta]
title = "Sitka Sound Fishing Boat"
author = "student_demo_2"
quality = 2

[simulation]
godot_version = "4.3"
scene = "fishing_boat.tscn"

[ai]
model_used = "claude-3-5-sonnet"
work_ratio = 0.60',
        'godot/fishing-boat/',
        2, 1, 1, 8, 1, 22, datetime('now', '-5 days'), datetime('now')
    );

-- Sample forks
INSERT OR IGNORE INTO forks (id, parent_id, child_id, forker_id, merged, created_at) VALUES
    ('fk_001', 'cr_001', 'cr_006', 'usr_002', 0, datetime('now', '-10 days')),
    ('fk_002', 'cr_002', 'cr_007', 'usr_003', 0, datetime('now', '-5 days'));

-- Sample feedback (likes, comments, verifications)
INSERT OR IGNORE INTO feedback (id, creation_id, user_id, type, content, grain_tokens, created_at) VALUES
    -- Likes for LED Circuit
    ('fb_001', 'cr_001', 'usr_002', 'like', NULL, 1, datetime('now', '-24 days')),
    ('fb_002', 'cr_001', 'usr_003', 'like', NULL, 1, datetime('now', '-20 days')),
    -- Comments for LED Circuit
    ('fb_003', 'cr_001', 'usr_003', 'comment', 'Great intro to circuits! The resistor calculator is very helpful.', 2, datetime('now', '-22 days')),
    ('fb_004', 'cr_001', 'usr_002', 'comment', 'Helped me understand voltage drop!', 2, datetime('now', '-18 days')),
    -- Verification for Water Mill
    ('fb_005', 'cr_002', 'usr_003', 'verification', 'Verified - physics simulation is accurate', 5, datetime('now', '-15 days')),
    ('fb_006', 'cr_002', 'usr_002', 'verification', 'Works well for teaching energy conversion', 5, datetime('now', '-12 days')),
    -- Likes for Water Mill
    ('fb_007', 'cr_002', 'usr_001', 'like', NULL, 1, datetime('now', '-19 days')),
    ('fb_008', 'cr_002', 'usr_002', 'like', NULL, 1, datetime('now', '-16 days')),
    ('fb_009', 'cr_002', 'usr_003', 'like', NULL, 1, datetime('now', '-14 days')),
    -- Feedback for Tutorial Bot
    ('fb_010', 'cr_003', 'usr_001', 'like', NULL, 1, datetime('now', '-14 days')),
    ('fb_011', 'cr_003', 'usr_003', 'comment', 'Very helpful for beginners!', 2, datetime('now', '-13 days')),
    -- Feedback for Bazaar Widget
    ('fb_012', 'cr_004', 'usr_001', 'like', NULL, 1, datetime('now', '-9 days')),
    ('fb_013', 'cr_004', 'usr_002', 'like', NULL, 1, datetime('now', '-8 days')),
    ('fb_014', 'cr_004', 'usr_001', 'comment', 'Great work on the fork UI!', 2, datetime('now', '-7 days')),
    -- Verification for Bazaar Widget
    ('fb_015', 'cr_004', 'usr_001', 'verification', 'Code is clean and well-documented', 5, datetime('now', '-6 days')),
    -- Feedback for Fishing Boat
    ('fb_016', 'cr_005', 'usr_001', 'like', NULL, 1, datetime('now', '-4 days')),
    ('fb_017', 'cr_005', 'usr_003', 'comment', 'Good starting point for Sitka Sound!', 2, datetime('now', '-3 days'));

-- Sample merge requests
INSERT OR IGNORE INTO merge_requests (id, fork_id, status, title, description, created_at) VALUES
    ('mr_001', 'fk_001', 'approved', 'Add battery indicator', 'Added visual battery level indicator to the circuit', datetime('now', '-8 days')),
    ('mr_002', 'fk_002', 'pending', 'Optimize physics', 'Reduced physics calculations for better performance', datetime('now', '-2 days'));

-- Sample code generations
INSERT OR IGNORE INTO code_generations (
    id, user_id, creation_id, prompt, model_used, quality_level,
    tokens_generated, work_ratio, verified, created_at
) VALUES
    ('gen_001', 'usr_001', 'cr_004', 'Create a Theia extension for browsing community creations', 'claude-3-5-sonnet', 'balanced', 2500, 0.75, 1, datetime('now', '-10 days')),
    ('gen_002', 'usr_002', 'cr_005', 'Generate a Godot scene for a fishing boat', 'claude-3-5-haiku', 'fast', 1200, 0.60, 1, datetime('now', '-5 days')),
    ('gen_003', 'usr_003', NULL, 'Create a Cloudflare Worker for asset generation', 'claude-opus-4-5', 'premium', 3500, 0.85, 1, datetime('now', '-1 day'));
