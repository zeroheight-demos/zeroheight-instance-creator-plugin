// This file runs in the Figma plugin sandbox

interface GenerateOptions {
  includeVariants: boolean;
  includeBooleans: boolean;
  naming: 'simple' | 'complex';
  selectedVariants?: Record<string, string[]>; // Property name -> array of selected values
  selectedBooleans?: string[]; // Array of selected boolean property names
}

interface VariableCollectionInfo {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
}

// Helper function to get all variant combinations
// Works with both ComponentNode and ComponentSetNode
function getAllVariantCombinations(component: ComponentNode | ComponentSetNode): Array<Record<string, string>> {
  // For component sets, collect all unique variant property values from all child components
  // For individual components, use componentPropertyDefinitions to get variant options
  let propertyValuesMap: Record<string, Set<string>> = {};
  
  if (component.type === 'COMPONENT_SET') {
    const componentSet = component as ComponentSetNode;
    // Collect all variant property values from all child components
    for (const child of componentSet.children) {
      if (child.type === 'COMPONENT') {
        const variantProps = child.variantProperties;
        if (variantProps) {
          for (const propName in variantProps) {
            if (variantProps.hasOwnProperty(propName)) {
              if (!propertyValuesMap[propName]) {
                propertyValuesMap[propName] = new Set<string>();
              }
              propertyValuesMap[propName].add(variantProps[propName]);
            }
          }
        }
      }
    }
  } else {
    // For individual components, get variant properties from componentPropertyDefinitions
    const comp = component as ComponentNode;
    const componentProperties = comp.componentPropertyDefinitions;
    if (componentProperties) {
      for (const key in componentProperties) {
        if (componentProperties.hasOwnProperty(key)) {
          const prop = componentProperties[key];
          if (prop.type === 'VARIANT') {
            if (!propertyValuesMap[key]) {
              propertyValuesMap[key] = new Set<string>();
            }
            // Get all possible values from the variant property
            if (prop.variantOptions) {
              for (const option of prop.variantOptions) {
                propertyValuesMap[key].add(option);
              }
            }
          }
        }
      }
    }
  }
  
  if (Object.keys(propertyValuesMap).length === 0) {
    return [{}];
  }

  const propertyNames = Object.keys(propertyValuesMap);
  const combinations: Array<Record<string, string>> = [];

  function generateCombinations(index: number, current: Record<string, string>) {
    if (index >= propertyNames.length) {
      // Create a copy of current object
      const copy: Record<string, string> = {};
      for (const key in current) {
        if (current.hasOwnProperty(key)) {
          copy[key] = current[key];
        }
      }
      combinations.push(copy);
      return;
    }

    const propertyName = propertyNames[index];
    const values = Array.from(propertyValuesMap[propertyName]);
    
    if (values.length > 0) {
      for (const value of values) {
        current[propertyName] = value;
        generateCombinations(index + 1, current);
      }
    } else {
      generateCombinations(index + 1, current);
    }
  }

  generateCombinations(0, {});
  return combinations;
}

// Helper function to get all boolean combinations
// Works with both ComponentNode and ComponentSetNode
function getAllBooleanCombinations(component: ComponentNode | ComponentSetNode): Array<Record<string, boolean>> {
  const booleanProperties: Record<string, boolean[]> = {};
  
  // Get all boolean properties from component properties
  // For component sets, use the component set's property definitions directly
  // For variant components (children of component sets), use the parent component set's definitions
  let componentProperties: ComponentPropertyDefinitions | undefined = undefined;
  if (component.type === 'COMPONENT_SET') {
    // Component sets have property definitions at the set level
    componentProperties = (component as ComponentSetNode).componentPropertyDefinitions;
  } else {
    const comp = component as ComponentNode;
    // Check if this component is a variant (has a parent that's a component set)
    if (comp.parent && comp.parent.type === 'COMPONENT_SET') {
      // Use the parent component set's property definitions
      componentProperties = (comp.parent as ComponentSetNode).componentPropertyDefinitions;
    } else {
      // Non-variant component, use its own property definitions
      componentProperties = comp.componentPropertyDefinitions;
    }
  }
  
  if (componentProperties) {
    for (const key in componentProperties) {
      if (componentProperties.hasOwnProperty(key)) {
        const prop = componentProperties[key];
        if (prop.type === 'BOOLEAN') {
          booleanProperties[key] = [true, false];
        }
      }
    }
  }

  const propertyNames = Object.keys(booleanProperties);
  if (propertyNames.length === 0) {
    return [{}];
  }

  const combinations: Array<Record<string, boolean>> = [];

  function generateCombinations(index: number, current: Record<string, boolean>) {
    if (index >= propertyNames.length) {
      // Create a copy of current object
      const copy: Record<string, boolean> = {};
      for (const key in current) {
        if (current.hasOwnProperty(key)) {
          copy[key] = current[key];
        }
      }
      combinations.push(copy);
      return;
    }

    const propertyName = propertyNames[index];
    const values = booleanProperties[propertyName];
    
    for (const value of values) {
      current[propertyName] = value;
      generateCombinations(index + 1, current);
    }
  }

  generateCombinations(0, {});
  return combinations;
}

// Helper function to format property name to title case
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Helper function to format boolean property name naturally
function formatBooleanName(key: string, value: boolean): string {
  // Strip special characters like #23:5, #23:7, etc.
  let cleanedKey = key.replace(/#\d+:\d+/g, '').trim();
  
  // Convert camelCase/PascalCase to words
  const words = cleanedKey.replace(/([A-Z])/g, ' $1').trim().split(' ');
  const propertyName = words.map(w => toTitleCase(w)).join(' ');
  
  // Format as "With [Property]" or "Without [Property]" for better readability
  if (value) {
    return `With ${propertyName}`;
  } else {
    return `Without ${propertyName}`;
  }
}

// Helper function to generate instance name
function generateInstanceName(
  component: ComponentNode | ComponentSetNode,
  variantProps: Record<string, string>,
  booleanProps: Record<string, boolean>,
  naming: 'simple' | 'complex'
): string {
  // Use component set name if available, otherwise use component name
  let componentName: string;
  if (component.type === 'COMPONENT_SET') {
    componentName = component.name;
  } else if (component.parent && component.parent.type === 'COMPONENT_SET') {
    componentName = component.parent.name;
  } else {
    componentName = component.name;
  }

  if (naming === 'simple') {
    return componentName;
  }

  // Complex naming: [component name] - [Property: Value] - [With/Without Property]
  // Format: "Button - Primary - Pill - With Chevron - Without Leading Icon"
  const parts: string[] = [componentName];

  // Add variant properties as "Property: Value"
  const variantParts: string[] = [];
  for (const key in variantProps) {
    if (variantProps.hasOwnProperty(key)) {
      const value = variantProps[key];
      if (value) {
        // Convert property name to title case
        const propertyName = toTitleCase(key);
        const valueName = toTitleCase(value);
        variantParts.push(`${propertyName}: ${valueName}`);
      }
    }
  }
  
  if (variantParts.length > 0) {
    parts.push(variantParts.join(' - '));
  }

  // Add boolean properties as "With/Without Property"
  const booleanParts: string[] = [];
  for (const key in booleanProps) {
    if (booleanProps.hasOwnProperty(key)) {
      const value = booleanProps[key];
      booleanParts.push(formatBooleanName(key, value));
    }
  }
  
  if (booleanParts.length > 0) {
    parts.push(booleanParts.join(' - '));
  }

  return parts.join(' - ');
}

// Helper function to get variable collections
function getVariableCollections(): VariableCollectionInfo[] {
  const collections: VariableCollectionInfo[] = [];
  
  try {
    const figmaCollections = figma.variables.getLocalVariableCollections();
    
    for (const collection of figmaCollections) {
      const modes = collection.modes.map(mode => ({
        modeId: mode.modeId,
        name: mode.name
      }));
      
      collections.push({
        id: collection.id,
        name: collection.name,
        modes
      });
    }
  } catch (error) {
    console.error('Error getting variable collections:', error);
  }
  
  return collections;
}

// Helper function to set variable mode
// Note: Variable modes are document-level settings in Figma
// We'll create instances with the current mode and note that mode changes
// may require manual adjustment or the instances will use the current document mode
function setVariableMode(collectionId: string, modeId: string) {
  try {
    const collection = figma.variables.getVariableCollectionById(collectionId);
    if (collection) {
      // Variable modes are set at the document level
      // Instances created will use the current document mode
      // This is a limitation of the Figma API - modes cannot be set programmatically
      console.log(`Note: Variable mode ${modeId} for collection ${collectionId} should be set manually in the document`);
    }
  } catch (error) {
    console.error('Error accessing variable collection:', error);
  }
}

// Helper function to get the component and component set from selection
function getComponentFromSelection(selected: SceneNode): { component: ComponentNode; componentSet: ComponentSetNode | null } | null {
  if (selected.type === 'COMPONENT') {
    return { component: selected, componentSet: null };
  } else if (selected.type === 'COMPONENT_SET') {
    // For component sets, use the first child component to create instances
    // but use the component set's variant properties
    const componentSet = selected as ComponentSetNode;
    if (componentSet.children.length > 0) {
      const firstChild = componentSet.children[0];
      if (firstChild.type === 'COMPONENT') {
        return { component: firstChild, componentSet: componentSet };
      }
    }
    return null;
  }
  return null;
}

// Helper function to get available variant properties and their values
function getAvailableVariantProperties(component: ComponentNode | ComponentSetNode): Record<string, string[]> {
  const propertyValuesMap: Record<string, Set<string>> = {};
  
  if (component.type === 'COMPONENT_SET') {
    const componentSet = component as ComponentSetNode;
    // Collect all variant property values from all child components
    for (const child of componentSet.children) {
      if (child.type === 'COMPONENT') {
        const variantProps = child.variantProperties;
        if (variantProps) {
          for (const propName in variantProps) {
            if (variantProps.hasOwnProperty(propName)) {
              if (!propertyValuesMap[propName]) {
                propertyValuesMap[propName] = new Set<string>();
              }
              propertyValuesMap[propName].add(variantProps[propName]);
            }
          }
        }
      }
    }
  } else {
    // For individual components, get variant properties from componentPropertyDefinitions
    const comp = component as ComponentNode;
    const componentProperties = comp.componentPropertyDefinitions;
    if (componentProperties) {
      for (const key in componentProperties) {
        if (componentProperties.hasOwnProperty(key)) {
          const prop = componentProperties[key];
          if (prop.type === 'VARIANT') {
            if (!propertyValuesMap[key]) {
              propertyValuesMap[key] = new Set<string>();
            }
            // Get all possible values from the variant property
            if (prop.variantOptions) {
              for (const option of prop.variantOptions) {
                propertyValuesMap[key].add(option);
              }
            }
          }
        }
      }
    }
  }
  
  // Convert Sets to Arrays
  const result: Record<string, string[]> = {};
  for (const propName in propertyValuesMap) {
    if (propertyValuesMap.hasOwnProperty(propName)) {
      result[propName] = Array.from(propertyValuesMap[propName]);
    }
  }
  
  return result;
}

// Helper function to get available boolean properties
function getAvailableBooleanProperties(component: ComponentNode | ComponentSetNode): string[] {
  const booleanProperties: string[] = [];
  
  // Get all boolean properties from component properties
  let componentProperties: ComponentPropertyDefinitions | undefined = undefined;
  if (component.type === 'COMPONENT_SET') {
    componentProperties = (component as ComponentSetNode).componentPropertyDefinitions;
  } else {
    const comp = component as ComponentNode;
    if (comp.parent && comp.parent.type === 'COMPONENT_SET') {
      componentProperties = (comp.parent as ComponentSetNode).componentPropertyDefinitions;
    } else {
      componentProperties = comp.componentPropertyDefinitions;
    }
  }
  
  if (componentProperties) {
    for (const key in componentProperties) {
      if (componentProperties.hasOwnProperty(key)) {
        const prop = componentProperties[key];
        if (prop.type === 'BOOLEAN') {
          booleanProperties.push(key);
        }
      }
    }
  }
  
  return booleanProperties;
}

// Main function to generate instances
async function generateInstances(options: GenerateOptions) {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.notify('Please select a component or component set on the canvas first');
    return;
  }

  const selected = selection[0];
  const componentInfo = getComponentFromSelection(selected);
  
  if (!componentInfo) {
    if (selected.type === 'COMPONENT_SET') {
      figma.notify('Selected component set has no component variants. Please select a component set with variants.');
    } else {
      figma.notify(`Selected item is not a component or component set. Selected: ${selected.type}. Please select a component or component set.`);
    }
    return;
  }
  
  const { component, componentSet } = componentInfo;
  
  // If multiple items selected, use the first one and notify
  if (selection.length > 1) {
    figma.notify(`Multiple items selected. Using the first component: "${component.name}"`);
  }

  // Use component set name if available, otherwise use component name
  const componentName = componentSet ? componentSet.name : component.name;
  
  // Determine the source for variant and boolean combinations
  // If we have a component set, use it directly
  // If we have a variant component (child of component set), use its parent
  // Otherwise, use the component itself
  let variantSource: ComponentNode | ComponentSetNode;
  let booleanSource: ComponentNode | ComponentSetNode;
  
  if (componentSet) {
    // We have a component set - use it directly
    variantSource = componentSet;
    booleanSource = componentSet;
  } else if (component.parent && component.parent.type === 'COMPONENT_SET') {
    // Component is a variant - use its parent component set
    variantSource = component.parent as ComponentSetNode;
    booleanSource = component.parent as ComponentSetNode;
  } else {
    // Non-variant component - use it directly
    variantSource = component;
    booleanSource = component;
  }
  
  // Get all combinations, then filter based on selected options
  let variantCombinations = options.includeVariants
    ? getAllVariantCombinations(variantSource)
    : [{}];

  let booleanCombinations = options.includeBooleans
    ? getAllBooleanCombinations(booleanSource)
    : [{}];

  // Filter variant combinations based on selected variants
  if (options.includeVariants && options.selectedVariants && Object.keys(options.selectedVariants).length > 0) {
    variantCombinations = variantCombinations.filter(combo => {
      for (const propName in options.selectedVariants) {
        if (options.selectedVariants.hasOwnProperty(propName)) {
          const selectedValues = options.selectedVariants[propName];
          if (selectedValues && selectedValues.length > 0) {
            // If this property exists in combo, check if its value is selected
            if (combo.hasOwnProperty(propName)) {
              if (selectedValues.indexOf(combo[propName]) === -1) {
                return false; // This value is not selected
              }
            }
          }
        }
      }
      return true;
    });
  }

  // Filter boolean combinations based on selected booleans
  if (options.includeBooleans && options.selectedBooleans && options.selectedBooleans.length > 0) {
    booleanCombinations = booleanCombinations.filter(combo => {
      // Check if all properties in combo are in selectedBooleans
      for (const propName in combo) {
        if (combo.hasOwnProperty(propName)) {
          if (options.selectedBooleans.indexOf(propName) === -1) {
            return false; // This boolean property is not selected
          }
        }
      }
      return true;
    });
  }

  // Use component set name for the main frame
  const mainFrameName = componentSet ? componentSet.name : component.name;
  
  // Create main frame with horizontal wrapping layout
  const mainFrame = figma.createFrame();
  mainFrame.name = `${mainFrameName} - instance table`;
  mainFrame.layoutMode = 'HORIZONTAL';
  mainFrame.layoutWrap = 'WRAP';
  mainFrame.primaryAxisSizingMode = 'FIXED';
  mainFrame.counterAxisSizingMode = 'AUTO';
  mainFrame.resize(1100, 100); // Set max width to 1100px, height will auto-adjust
  mainFrame.paddingLeft = 0;
  mainFrame.paddingRight = 0;
  mainFrame.paddingTop = 0;
  mainFrame.paddingBottom = 0;
  mainFrame.itemSpacing = 20;
  mainFrame.counterAxisSpacing = 20;
  mainFrame.fills = []; // Transparent background

  // Helper function to create a dashed line separator
  function createDashedLine(width: number, height: number, isVertical: boolean, thickness: number = 1): RectangleNode {
    const line = figma.createRectangle();
    line.name = 'Separator';
    line.resize(width, height);
    line.fills = [];
    line.strokes = [{ type: 'SOLID', color: { r: 0.592, g: 0.278, b: 1.0 } }]; // #9747FF
    line.strokeWeight = thickness;
    line.strokeAlign = 'CENTER';
    if (thickness === 1) {
      line.dashPattern = [4, 4]; // Dashed pattern for thin lines
    }
    // Thick lines (thickness > 1) are solid (no dash pattern)
    line.strokeCap = 'ROUND';
    return line;
  }

  // Helper function to create a label text (font already loaded)
  function createLabel(text: string): TextNode {
    const label = figma.createText();
    label.characters = text;
    label.fontSize = 10; // Smaller font for property labels
    label.fills = [{ type: 'SOLID', color: { r: 0.592, g: 0.278, b: 1.0 } }]; // #9747FF
    return label;
  }

  // Organize instances by property combinations for matrix layout
  // Group by boolean properties first (columns), then by variant properties (rows)
  const booleanKeys = booleanCombinations.length > 0 && Object.keys(booleanCombinations[0]).length > 0
    ? Object.keys(booleanCombinations[0])
    : [];
  const variantKeys = variantCombinations.length > 0 && Object.keys(variantCombinations[0]).length > 0
    ? Object.keys(variantCombinations[0])
    : [];

  // Create instances and organize them
  const instanceMap = new Map<string, { instance: InstanceNode; variantProps: Record<string, string>; booleanProps: Record<string, boolean> }>();
  
  for (const variantProps of variantCombinations) {
    for (const booleanProps of booleanCombinations) {
      // Create instance
      const instance = component.createInstance();
      
      // Batch all properties together for faster setting
      const allProps: Record<string, string | boolean> = {};
      
      // Add variant properties
      for (const key in variantProps) {
        if (variantProps.hasOwnProperty(key)) {
          allProps[key] = variantProps[key];
        }
      }
      
      // Add boolean properties
      for (const key in booleanProps) {
        if (booleanProps.hasOwnProperty(key)) {
          allProps[key] = booleanProps[key];
        }
      }
      
      // Set all properties at once
      try {
        instance.setProperties(allProps);
      } catch (error) {
        console.warn(`Could not set properties:`, error);
      }

      // Generate and set name
      const instanceName = generateInstanceName(component, variantProps, booleanProps, options.naming);
      instance.name = instanceName;

      // Create key for organizing
      const variantKey = Object.keys(variantProps).map(k => `${k}=${variantProps[k]}`).join(', ') || 'default';
      const booleanKey = Object.keys(booleanProps).map(k => `${k}=${booleanProps[k]}`).join(', ') || 'default';
      const mapKey = `${variantKey}|${booleanKey}`;
      
      instanceMap.set(mapKey, { instance, variantProps, booleanProps });
    }
  }

  // Load font once for all text
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Create instance frames for all instances with property labels
  for (const [mapKey, instanceData] of instanceMap.entries()) {
    const instanceFrame = figma.createFrame();
    
    // Use naming convention for the frame name
    const frameName = generateInstanceName(component, instanceData.variantProps, instanceData.booleanProps, options.naming);
    instanceFrame.name = frameName;
    
    // Set up autolayout
    instanceFrame.layoutMode = 'VERTICAL';
    instanceFrame.primaryAxisSizingMode = 'AUTO';
    instanceFrame.counterAxisSizingMode = 'AUTO';
    instanceFrame.paddingLeft = 24;
    instanceFrame.paddingRight = 24;
    instanceFrame.paddingTop = 24;
    instanceFrame.paddingBottom = 24;
    instanceFrame.itemSpacing = 8;
    instanceFrame.clipsContent = false;
    instanceFrame.fills = [];
    
    // Add instance
    instanceFrame.appendChild(instanceData.instance);
    
    // Create property labels container
    const labelsContainer = figma.createFrame();
    labelsContainer.name = 'Property Labels';
    labelsContainer.layoutMode = 'VERTICAL';
    labelsContainer.primaryAxisSizingMode = 'AUTO';
    labelsContainer.counterAxisSizingMode = 'AUTO';
    labelsContainer.paddingLeft = 0;
    labelsContainer.paddingRight = 0;
    labelsContainer.paddingTop = 0;
    labelsContainer.paddingBottom = 0;
    labelsContainer.itemSpacing = 4;
    labelsContainer.fills = [];
    
    // Add all variant properties
    for (const key in instanceData.variantProps) {
      if (instanceData.variantProps.hasOwnProperty(key)) {
        const propLabel = createLabel(`${key}: ${instanceData.variantProps[key]}`);
        labelsContainer.appendChild(propLabel);
      }
    }
    
    // Add all boolean properties
    for (const key in instanceData.booleanProps) {
      if (instanceData.booleanProps.hasOwnProperty(key)) {
        const propLabel = createLabel(`${key}: ${instanceData.booleanProps[key] ? 'True' : 'False'}`);
        labelsContainer.appendChild(propLabel);
      }
    }
    
    instanceFrame.appendChild(labelsContainer);
    mainFrame.appendChild(instanceFrame);
  }

  // All instances have been added directly to mainFrame with horizontal wrapping layout

  // Position main frame near the component
  mainFrame.x = component.x + component.width + 100;
  mainFrame.y = component.y;

  // Select the main frame
  figma.currentPage.selection = [mainFrame];
  figma.viewport.scrollAndZoomIntoView([mainFrame]);

  figma.notify(`Created instance table with ${variantCombinations.length * booleanCombinations.length} instances`);
}

// Settings storage key
const SETTINGS_KEY = 'zeroheight-instance-creator-settings';

// Load settings from clientStorage
async function loadSettings(): Promise<GenerateOptions | null> {
  try {
    const settings = await figma.clientStorage.getAsync(SETTINGS_KEY);
    return settings || null;
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
}

// Save settings to clientStorage
async function saveSettings(settings: GenerateOptions): Promise<void> {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch (error) {
    console.error('Error saving settings:', error);
    figma.notify('Failed to save settings');
  }
}

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-instances') {
    await generateInstances(msg.options);
  } else if (msg.type === 'load-settings') {
    const settings = await loadSettings();
    figma.ui.postMessage({
      type: 'settings-loaded',
      settings
    });
  } else if (msg.type === 'save-settings') {
    await saveSettings(msg.settings);
    figma.notify('Settings saved');
  } else if (msg.type === 'get-selected-component') {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
      const selected = selection[0];
      if (selected.type === 'COMPONENT' || selected.type === 'COMPONENT_SET') {
        const componentInfo = getComponentFromSelection(selected);
        if (componentInfo) {
          const { component, componentSet } = componentInfo;
          
          // Determine the source for variant and boolean properties
          let variantSource: ComponentNode | ComponentSetNode;
          let booleanSource: ComponentNode | ComponentSetNode;
          
          if (componentSet) {
            variantSource = componentSet;
            booleanSource = componentSet;
          } else if (component.parent && component.parent.type === 'COMPONENT_SET') {
            variantSource = component.parent as ComponentSetNode;
            booleanSource = component.parent as ComponentSetNode;
          } else {
            variantSource = component;
            booleanSource = component;
          }
          
          const variantProperties = getAvailableVariantProperties(variantSource);
          const booleanProperties = getAvailableBooleanProperties(booleanSource);
          
          figma.ui.postMessage({
            type: 'selected-component',
            component: {
              name: componentSet ? componentSet.name : component.name,
              type: selected.type,
              variantProperties: variantProperties,
              booleanProperties: booleanProperties
            }
          });
        } else {
          figma.ui.postMessage({
            type: 'selected-component',
            component: null
          });
        }
      } else {
        figma.ui.postMessage({
          type: 'selected-component',
          component: null
        });
      }
    } else {
      figma.ui.postMessage({
        type: 'selected-component',
        component: null
      });
    }
  }
};

// Listen for selection changes
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  if (selection.length > 0) {
    const selected = selection[0];
    if (selected.type === 'COMPONENT' || selected.type === 'COMPONENT_SET') {
      const componentInfo = getComponentFromSelection(selected);
      if (componentInfo) {
        const { component, componentSet } = componentInfo;
        
        // Determine the source for variant and boolean properties
        let variantSource: ComponentNode | ComponentSetNode;
        let booleanSource: ComponentNode | ComponentSetNode;
        
        if (componentSet) {
          variantSource = componentSet;
          booleanSource = componentSet;
        } else if (component.parent && component.parent.type === 'COMPONENT_SET') {
          variantSource = component.parent as ComponentSetNode;
          booleanSource = component.parent as ComponentSetNode;
        } else {
          variantSource = component;
          booleanSource = component;
        }
        
        const variantProperties = getAvailableVariantProperties(variantSource);
        const booleanProperties = getAvailableBooleanProperties(booleanSource);
        
        figma.ui.postMessage({
          type: 'selected-component',
          component: {
            name: componentSet ? componentSet.name : component.name,
            type: selected.type,
            variantProperties: variantProperties,
            booleanProperties: booleanProperties
          }
        });
      } else {
        figma.ui.postMessage({
          type: 'selected-component',
          component: null
        });
      }
    } else {
      figma.ui.postMessage({
        type: 'selected-component',
        component: null
      });
    }
  } else {
    figma.ui.postMessage({
      type: 'selected-component',
      component: null
    });
  }
});

// Show UI
figma.showUI(__html__, { width: 300, height: 450 });

// Load and send settings on startup
loadSettings().then(settings => {
  figma.ui.postMessage({
    type: 'settings-loaded',
    settings
  });
});


