# Zeroheight Instance Creator

A Figma plugin that helps you create instance tables for all prop variations of a component, perfect for documenting components in Zeroheight.

## Features

- **Generate instance tables** with all variant and boolean prop combinations
- **Support for brand/mode variables** - create instances for different variable modes
- **Flexible naming options** - simple or complex naming conventions
- **Automatic layout** - organizes instances in a clean grid layout

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. In Figma, go to Plugins → Development → Import plugin from manifest...
5. Select the `manifest.json` file from this directory

## Usage

1. Select a component in your Figma file
2. Run the plugin (Plugins → Development → Zeroheight Instance Creator)
3. Configure your options:
   - **Include Variants**: Generate instances for all variant property combinations
   - **Include Booleans**: Generate instances for all boolean property combinations
   - **Include Brand**: Include variable mode variations
   - **Brand Mode**: Select a specific mode (or leave empty to use all modes)
   - **Instance Naming**: Choose between simple or complex naming
4. Click "Generate Instance Table"

## Naming Conventions

### Simple Naming
Each instance frame is named: `[component name]`

### Complex Naming
Each instance frame is named: `[component name] - [variant name/s] - [boolean name/s] [on or off]`

## Output Structure

The plugin creates a frame named `[component name] - instance table` containing:

- If brands are included: Groups named `[component name] - [brand]` containing instances for each brand mode
- If no brands: Instances organized in a grid layout

Each instance is wrapped in a frame with the appropriate naming convention.

## Development

To watch for changes during development:

```bash
npm run watch
```

Then reload the plugin in Figma after making changes.

