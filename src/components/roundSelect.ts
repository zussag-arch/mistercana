// Tendina arrotondata: al clic su un <select> apre un elenco con lo stile dell'app
// al posto di quello squadrato del sistema. Tastiera e valori restano del <select>.
let open: { menu: HTMLElement; select: HTMLSelectElement } | null = null

function close(): void {
  open?.menu.remove()
  open = null
}

function show(select: HTMLSelectElement): void {
  close()
  const rect = select.getBoundingClientRect()
  const menu = document.createElement('div')
  menu.className = 'round-select-menu'
  menu.setAttribute('role', 'listbox')
  ;[...select.options].forEach((option, index) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'round-select-option' + (index === select.selectedIndex ? ' selected' : '')
    item.textContent = option.textContent
    item.disabled = option.disabled
    item.addEventListener('click', () => {
      select.selectedIndex = index
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
      close()
      select.focus()
    })
    menu.append(item)
  })
  document.body.append(menu)
  const below = window.innerHeight - rect.bottom
  const height = Math.min(menu.scrollHeight, 320)
  menu.style.left = `${rect.left}px`
  menu.style.minWidth = `${rect.width}px`
  menu.style.top = below > height + 12 || below > rect.top ? `${rect.bottom + 6}px` : `${rect.top - height - 6}px`
  menu.querySelector<HTMLElement>('.selected')?.scrollIntoView({ block: 'nearest' })
  open = { menu, select }
}

export function initRoundSelects(): void {
  document.addEventListener('mousedown', (event) => {
    const target = event.target as HTMLElement | null
    if (open && target && open.menu.contains(target)) return
    const select = target?.closest('select')
    if (select && !select.multiple && !select.disabled && select.size <= 1) {
      event.preventDefault()
      if (open?.select === select) close()
      else show(select)
      return
    }
    close()
  }, true)
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close() })
  window.addEventListener('resize', close)
  document.addEventListener('scroll', (event) => {
    if (open && !open.menu.contains(event.target as Node)) close()
  }, true)
}
