import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import { Box, Link, Typography } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { Package, RawCategory } from '@site/src/lib/ecosystem/types';
import {
  WorkflowSection,
  groupByStage,
  tileSections,
  toolAnchorIds,
  workflowSections,
} from '@site/src/lib/ecosystem/workflow';
import EcosystemFlowchart, { NAVBAR_CLEARANCE, StepNumber, UNSTYLED_LIST } from './EcosystemFlowchart';
import PackageCard from './PackageCard';

// The "Which tool do I use for what?" page: the flowchart of the MEDS workflow and, beside it on wide screens or
// below it on narrow ones, a tile for every tool in it, grouped by step, with the tool's stars and links.
//
// A tool's chips in the flowchart link to its tile (`#tool-<name>`, see `toolAnchorIds`), so they work without
// JavaScript. With it, clicking a chip scrolls the tiles (or, on narrow screens, the page) to the tool's tile,
// highlights it and moves the keyboard focus to it, and the URL's hash keeps the selection, so it can be shared.

/** Where Docusaurus shows the docs sidebar, and this page puts the tiles beside the flowchart. */
const WIDE_LAYOUT = '(min-width: 997px)';
const WIDE_MEDIA = `@media ${WIDE_LAYOUT}`;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** The id of the flowchart, which "Back to the flowchart" links to. */
const FLOWCHART_ID = 'ecosystem-flowchart';
const TILES_HEADING_ID = 'ecosystem-tool-tiles';

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

interface ToolTileProps {
  pkg: Package;
  id: string;
  selected: boolean;
  /** Counts the highlights of the selected tile, so that each one plays anew; 0 while none should play. */
  highlight: number;
  onBack: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

function ToolTile({ pkg, id, selected, highlight, onBack }: ToolTileProps): React.JSX.Element {
  // Registers the tile's id as an anchor of this page, so that the build checks links to it from other pages, such
  // as the tool names in the quick start visual guide (WorkflowOverview.tsx).
  useBrokenLinks().collectAnchor(id);
  return (
    <Box
      id={id}
      // Focusable from script only, so that clicking the tool's chip can move the keyboard focus here.
      tabIndex={-1}
      role="group"
      aria-label={pkg.name}
      sx={{
        position: 'relative',
        borderRadius: 1,
        // When the tile is scrolled into view, keeps it (and its outline) clear of the navbar or, in the panel,
        // of its edges and of the "back to top" button that Docusaurus shows at the bottom right of the window.
        scrollMarginTop: NAVBAR_CLEARANCE,
        [WIDE_MEDIA]: { scrollMarginTop: '0.75rem', scrollMarginBottom: '4rem' },
        outline: theme => (selected ? `2px solid ${theme.palette.primary.main}` : 'none'),
        outlineOffset: 2,
      }}
    >
      <PackageCard pkg={pkg} />
      {selected && highlight > 0 && (
        <Box
          // A new key restarts the animation.
          key={highlight}
          aria-hidden
          data-highlight
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 1,
            pointerEvents: 'none',
            bgcolor: theme => alpha(theme.palette.primary.main, 0.16),
            animation: `${fadeOut} 1.2s ease-in 0.6s both`,
          }}
        />
      )}
      {selected && (
        // Beside the flowchart, it is in view anyway.
        <Box sx={{ mt: 0.75, [WIDE_MEDIA]: { display: 'none' } }}>
          <Link
            href={`#${FLOWCHART_ID}`}
            onClick={onBack}
            variant="body2"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            <ArrowUpwardIcon fontSize="inherit" />
            Back to the flowchart
          </Link>
        </Box>
      )}
    </Box>
  );
}

interface ToolTilesProps extends Omit<ToolTileProps, 'pkg' | 'id' | 'selected'> {
  sections: WorkflowSection[];
  toolIds: Map<string, string>;
  selectedId?: string;
}

/** The tiles of the tools, grouped like the flowchart's steps; on wide screens, a sticky panel that scrolls. */
function ToolTiles({ sections, toolIds, selectedId, ...tileProps }: ToolTilesProps): React.JSX.Element {
  return (
    <Box
      component="section"
      aria-labelledby={TILES_HEADING_ID}
      sx={{
        [WIDE_MEDIA]: {
          // Stays in view, below the navbar, while the flowchart scrolls by.
          position: 'sticky',
          top: 'calc(var(--ifm-navbar-height) + 1rem)',
          maxHeight: 'calc(100vh - var(--ifm-navbar-height) - 2rem)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          // Keeps the outline of a selected tile clear of the panel's edges.
          px: 1,
        },
      }}
    >
      <Typography id={TILES_HEADING_ID} variant="h6" component="h2" sx={{ mt: 0, mb: 1.5 }}>
        Tools by step
      </Typography>
      {sections.map(({ stage, step, categories }) => (
        <Box key={stage.id} sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {step && <StepNumber step={step} size={22} />}
            <Typography variant="subtitle2" component="h3" sx={{ m: 0, fontWeight: 600 }}>
              {stage.title}
            </Typography>
          </Box>
          {categories.map(({ category, packages }) => (
            <Box key={category.topic} sx={{ '& + &': { mt: 1.5 } }}>
              {categories.length > 1 && (
                <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 0.5 }}>
                  {category.name}
                </Typography>
              )}
              <Box
                component="ul"
                sx={{
                  ...UNSTYLED_LIST,
                  display: 'grid',
                  // One column beside the flowchart; as many as fit below it.
                  gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))',
                  gap: 1.5,
                }}
              >
                {packages.map(pkg => {
                  const id = toolIds.get(pkg.name)!;
                  return (
                    <li key={pkg.name}>
                      <ToolTile pkg={pkg} id={id} selected={id === selectedId} {...tileProps} />
                    </li>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * The flowchart of the MEDS workflow with the tiles of its tools. Each tool has one tile, at the first step that
 * lists it (see `tileSections`), which all of its chips link to.
 */
export default function EcosystemWorkflow({
  data,
}: {
  data: Record<string, RawCategory>;
}): React.JSX.Element {
  const { sections, tiles, toolIds } = useMemo(() => {
    const sections = workflowSections(groupByStage(parseCategoryMap(data)));
    return { sections, tiles: tileSections(sections), toolIds: toolAnchorIds(sections) };
  }, [data]);
  const flowchartRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [highlight, setHighlight] = useState(0);

  /** Selects a tool and scrolls its tile into view: smoothly, and moving the focus to it, if `byClick`. */
  const showTile = useCallback((id: string, byClick: boolean) => {
    const tile = document.getElementById(id)!;
    const reduceMotion = window.matchMedia(REDUCED_MOTION).matches;
    tile.scrollIntoView({
      behavior: byClick && !reduceMotion ? 'smooth' : 'auto',
      // Beside the flowchart, scroll the tiles just enough to show this one, which leaves the page (and so the
      // flowchart) where it is; below the flowchart, scroll the page to the tile.
      block: window.matchMedia(WIDE_LAYOUT).matches ? 'nearest' : 'start',
    });
    if (byClick) tile.focus({ preventScroll: true });
    setSelectedId(id);
    setHighlight(count => (reduceMotion ? 0 : count + 1));
  }, []);

  // Selects the tool in the URL's hash, if any: when the page is opened, and when the hash changes.
  useEffect(() => {
    const ids = new Set(toolIds.values());
    const showTileInUrl = () => {
      const id = window.location.hash.slice(1);
      if (ids.has(id)) showTile(id, false);
    };
    showTileInUrl();
    window.addEventListener('hashchange', showTileInUrl);
    return () => window.removeEventListener('hashchange', showTileInUrl);
  }, [toolIds, showTile]);

  const selectTool = (id: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    // Leave clicks that open the link elsewhere, such as in a new tab, to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Not through the router: Docusaurus would scroll the page to the tile, even beside the flowchart.
    window.history.replaceState(window.history.state, '', `#${id}`);
    showTile(id, true);
  };

  // Returns to the selected tool's chip, rather than the top of the flowchart.
  const backToFlowchart = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const chip = flowchartRef.current!.querySelector<HTMLElement>(`a[href="#${selectedId}"]`)!;
    const reduceMotion = window.matchMedia(REDUCED_MOTION).matches;
    chip.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    chip.focus({ preventScroll: true });
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 4,
        mb: 4,
        [WIDE_MEDIA]: {
          gridTemplateColumns: 'minmax(0, 3fr) minmax(17rem, 2fr)',
          gap: 3,
          // Lets the tiles' panel be shorter than the flowchart, so that it can stick.
          alignItems: 'start',
        },
      }}
    >
      <Box id={FLOWCHART_ID} ref={flowchartRef} sx={{ scrollMarginTop: NAVBAR_CLEARANCE }}>
        <EcosystemFlowchart
          sections={sections}
          toolIds={toolIds}
          selectedId={selectedId}
          onSelectTool={selectTool}
        />
      </Box>
      <ToolTiles
        sections={tiles}
        toolIds={toolIds}
        selectedId={selectedId}
        highlight={highlight}
        onBack={backToFlowchart}
      />
    </Box>
  );
}
