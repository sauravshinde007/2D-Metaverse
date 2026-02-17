
# Tiled Map Changes: Interactables

To enable interactions (like sitting on chairs to start a meeting or using computers), you need to add a new **Object Layer** in Tiled with specific properties.

## Steps

1.  **Open Tiled**: Load your map file (`map2.tmj` or whatever you are using).
2.  **Create New Layer**:
    *   Right-click in the **Layers** panel.
    *   Select `New` -> `Object Layer`.
    *   Name it exactly: `Interactables` (Case sensitive!).

3.  **Add Objects**:
    *   Select the `Insert Rectangle` tool (or point tool).
    *   Draw a box over the object you want to interact with (e.g., over a chair).

4.  **Configure Properties**:
    *   Select the object you just drew.
    *   In the **Properties** panel (usually on the left):
        *   **Name**: Give it a descriptive name (optional, e.g., "Meeting Chair 1").
        *   **Type**: Set the `Type` field (at the top of properties) to `chair` or `computer`.
        *   **Custom Properties**:
            *   Add a String property named `id` (e.g., `chair_1`, `comp_lobby`).
            *   (Optional) If you didn't set the main Type field, add a String property named `type` with value `chair` or `computer`.

## Example Structure

For a **Meeting Room Chair**:
*   **Layer**: `Interactables`
*   **Object**: A rectangle over the chair sprite.
*   **Type**: `chair`
*   **Custom Properties**:
    *   (None strictly required if Type is set, but consistent IDs help debugging).

For a **Computer**:
*   **Layer**: `Interactables`
*   **Object**: A rectangle over the PC.
*   **Type**: `computer`

## Summary Checklist
- [ ] Layer named `Interactables` exists.
- [ ] Objects have `Type` set to `chair` or `computer`.
- [ ] Objects are placed correctly over the visualized tiles.
- [ ] Save and export map as JSON (`.tmj` or `.json`).
