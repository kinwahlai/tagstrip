import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentTypeBadge } from './ContentTypeBadge'

describe('ContentTypeBadge', () => {
  it('is boxed only when asked', () => {
    render(<ContentTypeBadge contentType="text" />)
    expect(screen.getByText('text')).not.toHaveClass('tag-boxed')
  })

  it('names what the word describes when boxed beside a filename', () => {
    render(<ContentTypeBadge contentType="scanned" boxed />)
    const tag = screen.getByText('scanned')
    expect(tag).toHaveClass('tag-boxed', 'tag-accent')
    expect(tag).toHaveAttribute('title', 'This page: scanned')
  })
})
