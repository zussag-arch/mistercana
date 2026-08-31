import type {
  PageId,
} from '../components/navigation'

let activePage: PageId =
  'dashboard'

export function getActivePage():
  PageId {
  return activePage
}

export function navigateTo(
  page: PageId,
): void {
  activePage =
    page
}

export function isActivePage(
  page: PageId,
): boolean {
  return (
    activePage ===
    page
  )
}