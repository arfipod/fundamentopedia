import type { GicsLevel, GicsTreeNode, ProfileRoot } from '../types';

export interface SearchItem {
  code: string;
  level: GicsLevel;
  fallbackName: string;
}

export interface IndexedData {
  byCodeTreeNode: Map<string, GicsTreeNode>;
  pathCodesByCode: Map<string, string[]>;
  searchItems: SearchItem[];
}

export function buildIndexes(profile: ProfileRoot): IndexedData {
  const byCodeTreeNode = new Map<string, GicsTreeNode>();
  const pathCodesByCode = new Map<string, string[]>();
  const searchItems: SearchItem[] = [];

  const walk = (nodes: GicsTreeNode[], pathCodes: string[]) => {
    for (const node of nodes) {
      const currentPath = [...pathCodes, node.code];
      byCodeTreeNode.set(node.code, node);
      pathCodesByCode.set(node.code, currentPath);
      searchItems.push({ code: node.code, level: node.level, fallbackName: node.name_es });
      if (node.children?.length) {
        walk(node.children, currentPath);
      }
    }
  };

  walk(profile.gics_tree, []);

  return { byCodeTreeNode, pathCodesByCode, searchItems };
}
