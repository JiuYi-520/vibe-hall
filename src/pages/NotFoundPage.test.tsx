import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('说明页面不存在，并给出回站入口', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/页面不存在/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '展开馆' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /愿望墙/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /论坛/ })).toBeInTheDocument()
  })
})
