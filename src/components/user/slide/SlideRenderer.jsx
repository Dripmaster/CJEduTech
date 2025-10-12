import { useEffect } from 'react'
import { useSlides } from './SlideProvider.jsx'
import { useSlideProgress } from './useSlideProgress'
import { pageComponentMap } from './pageComponentMap'
import './slide.css';
import { useNavigate } from 'react-router-dom'
import { RoundStepProvider, useRoundStep } from '../../../contexts/RoundStepContext.jsx'
import PageHeader from '@/components/common/PageHeader.jsx';

export default function SlideRenderer() {
  const { page, pageIndex, setPageIndex, config } = useSlides()
  const { clickedCount, requiredCount, remainingIds, allDone } = useSlideProgress()
  const navigate = useNavigate()   // 👈 추가
  const { round, setRound, step, setStep } = useRoundStep()

  const lastIndex = config.length - 1

  if (!page) return <div>끝</div>

  useEffect(() => {
    setStep(2)
    setRound(1)
  }, [setStep, setRound])

  const PageComponent = pageComponentMap[page.id]

  const handleNext = () => {
    setPageIndex(i => Math.min(config.length - 1, i + 1))
  }

  return (
    <div className="slide-div">
      <PageHeader title='CJ인 인재상 교육'></PageHeader>
      {PageComponent ? <PageComponent /> : <div>구현되지 않은 페이지: {page.id}</div>}
    </div>
  )
}