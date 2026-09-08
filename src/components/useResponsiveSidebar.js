import { useEffect, useState } from 'react'

const collapsedSidebarQuery = '(max-width: 760px), (min-width: 1025px)'

export function shouldCollapseSidebar(matchMedia = window.matchMedia.bind(window)) {
  return matchMedia(collapsedSidebarQuery).matches
}

export default function useResponsiveSidebar() {
  const [collapsed, setCollapsed] = useState(() => shouldCollapseSidebar())

  useEffect(() => {
    const responsiveLayout = window.matchMedia(collapsedSidebarQuery)
    const updateSidebar = (event) => setCollapsed(event.matches)

    responsiveLayout.addEventListener('change', updateSidebar)
    return () => responsiveLayout.removeEventListener('change', updateSidebar)
  }, [])

  return [collapsed, setCollapsed]
}
