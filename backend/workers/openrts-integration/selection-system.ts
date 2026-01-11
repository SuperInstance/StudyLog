/**
 * Selection System
 *
 * Handles unit selection mechanics for OpenRTS integration.
 *
 * ## Features
 *
 * - Single/double-click selection
 * - Drag box selection
 * - Control groups (number keys 0-9)
 * - Selection filtering by type
 * - Selection prioritization
 * - Multi-group management
 * - Selection sharing across products
 */

import type {
  Vector2,
  Vector3,
  UnitInstance,
  StructureInstance,
  SelectionState,
  SelectionGroup,
  UnitClass,
  UnitFaction,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface SelectionConfig {
  /** Maximum units that can be selected */
  maxSelection: number;

  /** Double-click time window (ms) */
  doubleClickTime: number;

  /** Selection box minimum size (pixels) */
  minBoxSize: number;

  /** Auto-select units of same type on double-click */
  selectSameType: boolean;

  /** Include structures in selection */
  includeStructures: boolean;

  /** Priority for unit types when selecting */
  typePriority: UnitClass[];

  /** Priority for factions when selecting */
  factionPriority: UnitFaction[];
}

export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  maxSelection: 100,
  doubleClickTime: 500,
  minBoxSize: 10,
  selectSameType: true,
  includeStructures: true,
  typePriority: ['hero', 'vehicle', 'infantry', 'aircraft', 'naval', 'structure'],
  factionPriority: ['player', 'ally', 'neutral', 'enemy'],
};

// ============================================================================
// Selection Hit Test
// ============================================================================

export interface SelectionHitTest {
  /** Unit/structure ID */
  id: string;

  /** Is this a structure */
  isStructure: boolean;

  /** Screen position (for click detection) */
  screenPosition: Vector2;

  /** Selection radius (in pixels) */
  radius: number;

  /** Unit instance data */
  unit?: UnitInstance;

  /** Structure instance data */
  structure?: StructureInstance;
}

// ============================================================================
// Selection Filter
// ============================================================================

export interface SelectionFilter {
  /** Minimum health (0-1) */
  minHealth?: number;

  /** Maximum health (0-1) */
  maxHealth?: number;

  /** Filter by unit class */
  classes?: UnitClass[];

  /** Filter by faction */
  factions?: UnitFaction[];

  /** Filter by owner */
  owners?: string[];

  /** Exclude certain IDs */
  exclude?: string[];

  /** Only certain IDs */
  include?: string[];

  /** Custom filter function */
  custom?: (unit: UnitInstance | StructureInstance) => boolean;
}

// ============================================================================
// Selection System Class
// ============================================================================

/**
 * Manages unit selection for RTS gameplay
 */
export class SelectionSystem {
  private state: SelectionState;
  private lastClickTime: number = 0;
  private lastClickUnit: string | null = null;
  private controlGroups: Map<number, string[]> = new Map();
  private selectionHistory: string[][] = [];

  constructor(
    private config: SelectionConfig = DEFAULT_SELECTION_CONFIG
  ) {
    this.state = {
      selectedUnits: [],
      isSelecting: false,
      controlGroups: new Map(),
    };
  }

  // ========================================================================
  // State Access
  // ========================================================================

  /**
   * Get current selection state
   */
  getState(): SelectionState {
    return {
      selectedUnits: [...this.state.selectedUnits],
      isSelecting: this.state.isSelecting,
      selectionStart: this.state.selectionStart
        ? { ...this.state.selectionStart }
        : undefined,
      selectionEnd: this.state.selectionEnd
        ? { ...this.state.selectionEnd }
        : undefined,
      controlGroups: new Map(this.controlGroups),
    };
  }

  /**
   * Get selected unit IDs
   */
  getSelectedUnits(): string[] {
    return [...this.state.selectedUnits];
  }

  /**
   * Get selection count
   */
  getSelectionCount(): number {
    return this.state.selectedUnits.length;
  }

  /**
   * Check if a unit is selected
   */
  isSelected(unitId: string): boolean {
    return this.state.selectedUnits.includes(unitId);
  }

  /**
   * Check if selection is empty
   */
  isEmpty(): boolean {
    return this.state.selectedUnits.length === 0;
  }

  // ========================================================================
  // Click Selection
  // ========================================================================

  /**
   * Handle click selection
   */
  handleClick(
    hitTest: SelectionHitTest | null,
    modifier: { ctrl: boolean; shift: boolean; alt: boolean }
  ): string[] {
    const now = Date.now();
    const isDoubleClick =
      hitTest &&
      hitTest.id === this.lastClickUnit &&
      now - this.lastClickTime < this.config.doubleClickTime;

    this.lastClickTime = now;
    this.lastClickUnit = hitTest?.id ?? null;

    if (!hitTest) {
      // Clicked on empty space
      if (!modifier.ctrl && !modifier.shift) {
        this.clearSelection();
      }
      return [];
    }

    if (isDoubleClick && this.config.selectSameType) {
      return this.selectSameType(hitTest, modifier);
    }

    return this.selectSingle(hitTest, modifier);
  }

  /**
   * Select a single unit
   */
  selectSingle(
    hitTest: SelectionHitTest,
    modifier: { ctrl: boolean; shift: boolean; alt: boolean }
  ): string[] {
    const id = hitTest.id;

    // If alt held, deselect only
    if (modifier.alt) {
      this.deselectUnit(id);
      return this.getSelectedUnits();
    }

    // If ctrl held, toggle selection
    if (modifier.ctrl) {
      if (this.isSelected(id)) {
        this.deselectUnit(id);
      } else {
        this.addToSelection([id]);
      }
      return this.getSelectedUnits();
    }

    // If shift held, add to selection
    if (modifier.shift) {
      this.addToSelection([id]);
      return this.getSelectedUnits();
    }

    // Otherwise, replace selection
    this.setSelection([id]);
    return [id];
  }

  /**
   * Select all units of same type
   */
  selectSameType(
    hitTest: SelectionHitTest,
    modifier: { ctrl: boolean; shift: boolean; alt: boolean },
    allUnits?: (UnitInstance | StructureInstance)[]
  ): string[] {
    if (!allUnits) {
      return [hitTest.id];
    }

    const sourceUnit = hitTest.unit || hitTest.structure;
    if (!sourceUnit) {
      return [hitTest.id];
    }

    // Find units of same definition
    const sameUnits = allUnits
      .filter((u) => {
        const def = (u as UnitInstance).definitionId;
        return def === (hitTest.unit?.definitionId || hitTest.structure?.definitionId);
      })
      .map((u) => u.instanceId || (u as StructureInstance).instanceId);

    if (modifier.ctrl) {
      this.addToSelection(sameUnits);
    } else {
      this.setSelection(sameUnits);
    }

    return this.getSelectedUnits();
  }

  // ========================================================================
  // Box Selection
  // ========================================================================

  /**
   * Start box selection
   */
  startBoxSelection(startPos: Vector2): void {
    this.state.isSelecting = true;
    this.state.selectionStart = startPos;
    this.state.selectionEnd = startPos;
  }

  /**
   * Update box selection drag
   */
  updateBoxSelection(currentPos: Vector2): void {
    if (this.state.isSelecting) {
      this.state.selectionEnd = currentPos;
    }
  }

  /**
   * End box selection
   */
  endBoxSelection(
    hitTests: SelectionHitTest[],
    modifier: { ctrl: boolean; shift: boolean }
  ): string[] {
    if (!this.state.selectionStart || !this.state.selectionEnd) {
      this.state.isSelecting = false;
      return this.getSelectedUnits();
    }

    const start = this.state.selectionStart;
    const end = this.state.selectionEnd;

    // Check if box is large enough
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    if (dx < this.config.minBoxSize || dy < this.config.minBoxSize) {
      this.state.isSelecting = false;
      this.state.selectionStart = undefined;
      this.state.selectionEnd = undefined;
      return this.getSelectedUnits();
    }

    // Find units within box
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const selected = hitTests
      .filter((hit) => {
        const x = hit.screenPosition.x;
        const y = hit.screenPosition.y;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      })
      .map((hit) => hit.id)
      .slice(0, this.config.maxSelection);

    if (modifier.ctrl) {
      this.addToSelection(selected);
    } else if (modifier.shift) {
      this.addToSelection(selected);
    } else {
      this.setSelection(selected);
    }

    this.state.isSelecting = false;
    this.state.selectionStart = undefined;
    this.state.selectionEnd = undefined;

    return this.getSelectedUnits();
  }

  // ========================================================================
  // Selection Management
  // ========================================================================

  /**
   * Set selection to specific units
   */
  setSelection(unitIds: string[]): void {
    this.saveToHistory();
    this.state.selectedUnits = unitIds.slice(0, this.config.maxSelection);
  }

  /**
   * Add units to selection
   */
  addToSelection(unitIds: string[]): void {
    this.saveToHistory();

    const existing = new Set(this.state.selectedUnits);
    for (const id of unitIds) {
      if (!existing.has(id) && this.state.selectedUnits.length < this.config.maxSelection) {
        this.state.selectedUnits.push(id);
        existing.add(id);
      }
    }
  }

  /**
   * Remove units from selection
   */
  removeFromSelection(unitIds: string[]): void {
    this.saveToHistory();
    const toRemove = new Set(unitIds);
    this.state.selectedUnits = this.state.selectedUnits.filter(
      (id) => !toRemove.has(id)
    );
  }

  /**
   * Deselect a specific unit
   */
  deselectUnit(unitId: string): void {
    this.removeFromSelection([unitId]);
  }

  /**
   * Clear all selection
   */
  clearSelection(): void {
    this.saveToHistory();
    this.state.selectedUnits = [];
  }

  /**
   * Select all units matching filter
   */
  selectAll(
    units: (UnitInstance | StructureInstance)[],
    filter?: SelectionFilter
  ): string[] {
    const filtered = this.applyFilter(units, filter);
    const ids = filtered
      .map((u) => u.instanceId || (u as StructureInstance).instanceId)
      .slice(0, this.config.maxSelection);

    this.setSelection(ids);
    return ids;
  }

  // ========================================================================
  // Control Groups
  // ========================================================================

  /**
   * Assign current selection to control group
   */
  assignControlGroup(groupId: number): void {
    this.controlGroups.set(groupId, [...this.state.selectedUnits]);
    this.state.controlGroups = new Map(this.controlGroups);
  }

  /**
   * Select a control group
   */
  selectControlGroup(
    groupId: number,
    modifier: { shift: boolean }
  ): string[] {
    const group = this.controlGroups.get(groupId);

    if (!group || group.length === 0) {
      return this.getSelectedUnits();
    }

    if (modifier.shift) {
      // Add to current selection
      this.addToSelection(group);
    } else {
      // Replace selection
      this.setSelection(group);
    }

    return this.getSelectedUnits();
  }

  /**
   * Get a control group
   */
  getControlGroup(groupId: number): string[] {
    return [...(this.controlGroups.get(groupId) || [])];
  }

  /**
   * Get all control groups
   */
  getAllControlGroups(): Map<number, string[]> {
    return new Map(this.controlGroups);
  }

  /**
   * Clear a control group
   */
  clearControlGroup(groupId: number): void {
    this.controlGroups.delete(groupId);
    this.state.controlGroups = new Map(this.controlGroups);
  }

  // ========================================================================
  // Selection History
  // ========================================================================

  /**
   * Undo last selection change
   */
  undoSelection(): string[] {
    if (this.selectionHistory.length > 0) {
      const previous = this.selectionHistory.pop()!;
      this.state.selectedUnits = previous;
      return [...previous];
    }
    return this.getSelectedUnits();
  }

  /**
   * Get selection history size
   */
  getHistorySize(): number {
    return this.selectionHistory.length;
  }

  /**
   * Clear selection history
   */
  clearHistory(): void {
    this.selectionHistory = [];
  }

  private saveToHistory(): void {
    if (this.selectionHistory.length > 50) {
      this.selectionHistory.shift();
    }
    this.selectionHistory.push([...this.state.selectedUnits]);
  }

  // ========================================================================
  // Selection Filtering
  // ========================================================================

  /**
   * Apply filter to unit list
   */
  applyFilter(
    units: (UnitInstance | StructureInstance)[],
    filter?: SelectionFilter
  ): (UnitInstance | StructureInstance)[] {
    if (!filter) {
      return [...units];
    }

    return units.filter((unit) => this.matchesFilter(unit, filter));
  }

  /**
   * Check if unit matches filter
   */
  matchesFilter(
    unit: UnitInstance | StructureInstance,
    filter: SelectionFilter
  ): boolean {
    // Check include/exclude lists
    const id = (unit as UnitInstance).instanceId ||
               (unit as StructureInstance).instanceId;

    if (filter.include && !filter.include.includes(id)) {
      return false;
    }
    if (filter.exclude && filter.exclude.includes(id)) {
      return false;
    }

    // Check health
    const healthRatio = (unit as UnitInstance).stats?.health /
                        (unit as UnitInstance).stats?.maxHealth ||
                        1;

    if (filter.minHealth !== undefined && healthRatio < filter.minHealth) {
      return false;
    }
    if (filter.maxHealth !== undefined && healthRatio > filter.maxHealth) {
      return false;
    }

    // Check classes
    if (filter.classes && filter.classes.length > 0) {
      const unitClass = (unit as UnitInstance).definitionId?.split('_')[0];
      // This would need proper class mapping in practice
    }

    // Check factions
    if (filter.factions && filter.factions.length > 0) {
      const unitFaction = (unit as UnitInstance).ownerId;
      // This would need proper faction mapping
    }

    // Check owners
    if (filter.owners && filter.owners.length > 0) {
      const ownerId = (unit as UnitInstance).ownerId ||
                      (unit as StructureInstance).ownerId;
      if (!filter.owners.includes(ownerId)) {
        return false;
      }
    }

    // Custom filter
    if (filter.custom && !filter.custom(unit)) {
      return false;
    }

    return true;
  }

  // ========================================================================
  // Selection Queries
  // ========================================================================

  /**
   * Get selection center position
   */
  getSelectionCenter(units?: Map<string, UnitInstance | StructureInstance>): Vector3 | null {
    if (this.state.selectedUnits.length === 0) {
      return null;
    }

    if (!units) {
      return null;
    }

    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;

    for (const id of this.state.selectedUnits) {
      const unit = units.get(id);
      if (unit) {
        const pos = (unit as UnitInstance).position ||
                   (unit as StructureInstance).position;
        sumX += pos.x;
        sumY += pos.y;
        sumZ += pos.z;
        count++;
      }
    }

    if (count === 0) {
      return null;
    }

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
    };
  }

  /**
   * Check if selection contains unit of specific type
   */
  hasType(unitClass: UnitClass, units?: Map<string, UnitInstance | StructureInstance>): boolean {
    if (!units) {
      return false;
    }

    for (const id of this.state.selectedUnits) {
      const unit = units.get(id) as UnitInstance;
      if (unit && unit.definitionId?.startsWith(unitClass)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get selection by type
   */
  getSelectionByType(units?: Map<string, UnitInstance | StructureInstance>): Map<UnitClass, string[]> {
    const result = new Map<UnitClass, string[]>();

    if (!units) {
      return result;
    }

    for (const id of this.state.selectedUnits) {
      const unit = units.get(id) as UnitInstance;
      if (unit) {
        // This would need proper type mapping
        const type = 'infantry' as UnitClass;
        if (!result.has(type)) {
          result.set(type, []);
        }
        result.get(type)!.push(id);
      }
    }

    return result;
  }

  /**
   * Prioritize units for selection (when at max capacity)
   */
  prioritizeSelection(
    candidates: string[],
    units?: Map<string, UnitInstance | StructureInstance>
  ): string[] {
    if (!units || candidates.length <= this.config.maxSelection) {
      return candidates;
    }

    // Sort by priority
    const prioritized = [...candidates].sort((a, b) => {
      const unitA = units.get(a) as UnitInstance;
      const unitB = units.get(b) as UnitInstance;

      if (!unitA || !unitB) {
        return 0;
      }

      // Priority by type
      const typePriorityA = this.config.typePriority.indexOf(
        this.getUnitClass(unitA)
      );
      const typePriorityB = this.config.typePriority.indexOf(
        this.getUnitClass(unitB)
      );

      if (typePriorityA !== typePriorityB) {
        return typePriorityA - typePriorityB;
      }

      // Then by faction
      const factionPriorityA = this.config.factionPriority.indexOf(
        this.getUnitFaction(unitA)
      );
      const factionPriorityB = this.config.factionPriority.indexOf(
        this.getUnitFaction(unitB)
      );

      return factionPriorityA - factionPriorityB;
    });

    return prioritized.slice(0, this.config.maxSelection);
  }

  private getUnitClass(unit: UnitInstance): UnitClass {
    // Extract class from definition or properties
    return 'infantry'; // Simplified
  }

  private getUnitFaction(unit: UnitInstance): UnitFaction {
    // Extract faction from owner or properties
    return 'neutral'; // Simplified
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<SelectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set maximum selection size
   */
  setMaxSelection(max: number): void {
    this.config.maxSelection = max;

    // Trim current selection if needed
    if (this.state.selectedUnits.length > max) {
      this.state.selectedUnits = this.state.selectedUnits.slice(0, max);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a selection system with configuration
 */
export function createSelectionSystem(
  config?: Partial<SelectionConfig>
): SelectionSystem {
  return new SelectionSystem({
    ...DEFAULT_SELECTION_CONFIG,
    ...config,
  });
}

/**
 * Create a StudyLoG-specific selection system
 */
export function createStudyLogSelection(): SelectionSystem {
  return new SelectionSystem({
    ...DEFAULT_SELECTION_CONFIG,
    maxSelection: 20, // Smaller for educational focus
    selectSameType: false, // More controlled selection
    includeStructures: true,
  });
}

/**
 * Create a DMLoG-specific selection system
 */
export function createDMLoGSelection(): SelectionSystem {
  return new SelectionSystem({
    ...DEFAULT_SELECTION_CONFIG,
    maxSelection: 50,
    selectSameType: true,
    includeStructures: false, // Don't select dungeon features
    typePriority: ['hero', 'infantry', 'vehicle', 'structure', 'aircraft', 'naval'],
  });
}

export default SelectionSystem;
