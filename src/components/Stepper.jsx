import React, { useState, Children, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import './Stepper.css'

export default function Stepper({
    children,
    initialStep = 1,
    activeStep, // Controlled prop
    layout = 'default', // 'default' | 'split'
    onStepChange = () => { },
    onFinalStepCompleted = () => { },
    stepCircleContainerClassName = '',
    stepContainerClassName = '',
    contentClassName = '',
    footerClassName = '',
    backButtonProps = {},
    nextButtonProps = {},
    backButtonText = 'Back',
    nextButtonText = 'Continue',
    disableStepIndicators = false,
    renderStepIndicator,
    ...rest
}) {
    const [internalStep, setInternalStep] = useState(initialStep)
    // Use activeStep if provided (controlled), otherwise internalStep (uncontrolled)
    const currentStep = activeStep !== undefined ? activeStep : internalStep

    const [direction, setDirection] = useState(0)
    const stepsArray = Children.toArray(children)
    const totalSteps = stepsArray.length
    const isCompleted = currentStep > totalSteps
    const isLastStep = currentStep === totalSteps

    const updateStep = (newStep) => {
        if (activeStep === undefined) {
            setInternalStep(newStep)
        }

        if (newStep > totalSteps) {
            onFinalStepCompleted()
        } else {
            onStepChange(newStep)
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setDirection(-1)
            updateStep(currentStep - 1)
        }
    }

    const handleNext = () => {
        if (!isLastStep) {
            setDirection(1);
            updateStep(currentStep + 1);
        }
    };

    const handleComplete = () => {
        setDirection(1);
        updateStep(totalSteps + 1);
    };

    const renderIndicators = (vertical = false) => (
        stepsArray.map((_, index) => {
            const stepNumber = index + 1
            const isNotLastStep = index < totalSteps - 1
            return (
                <React.Fragment key={stepNumber}>
                    {renderStepIndicator ? (
                        renderStepIndicator({
                            step: stepNumber,
                            currentStep,
                            onStepClick: clicked => {
                                setDirection(clicked > currentStep ? 1 : -1)
                                updateStep(clicked)
                            }
                        })
                    ) : (
                        <StepIndicator
                            step={stepNumber}
                            disableStepIndicators={disableStepIndicators}
                            currentStep={currentStep}
                            onClickStep={clicked => {
                                setDirection(clicked > currentStep ? 1 : -1)
                                updateStep(clicked)
                            }}
                        />
                    )}
                    {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} vertical={vertical} />}
                </React.Fragment>
            )
        })
    )

    return (
        <div className={`stepper-wrapper ${layout === 'split' ? 'layout-split' : ''}`} {...rest}>
            <div
                className={`stepper-card ${stepCircleContainerClassName}`}
            // border handled in CSS
            >
                {/* Horizontal Header (hidden on desktop if split) */}
                <div className={`stepper-header ${stepContainerClassName} ${layout === 'split' ? 'hidden-desktop' : ''}`}>
                    {renderIndicators(false)}
                </div>

                <StepContentWrapper
                    isCompleted={isCompleted}
                    currentStep={currentStep}
                    direction={direction}
                    className={`stepper-content-wrapper ${contentClassName}`}
                >
                    {stepsArray[currentStep - 1]}
                </StepContentWrapper>

                {!isCompleted && (
                    <div className={`stepper-footer ${footerClassName}`}>
                        <div className={`stepper-controls ${currentStep !== 1 ? 'has-back' : ''}`}>
                            {currentStep !== 1 && (
                                <button
                                    onClick={handleBack}
                                    className={`step-btn-back ${currentStep === 1 ? 'disabled' : ''}`}
                                    {...backButtonProps}
                                >
                                    {backButtonText}
                                </button>
                            )}
                            <button
                                onClick={isLastStep ? handleComplete : handleNext}
                                className="step-btn-next"
                                {...nextButtonProps}
                            >
                                {isLastStep ? 'Complete' : nextButtonText}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar (Right) for Split Layout */}
            {layout === 'split' && (
                <div className="stepper-sidebar">
                    {renderIndicators(true)}
                </div>
            )}
        </div>
    )
}

function StepContentWrapper({
    isCompleted,
    currentStep,
    direction,
    children,
    className = ''
}) {
    const [parentHeight, setParentHeight] = useState(0)

    return (
        <motion.div
            style={{ position: 'relative', overflow: 'hidden' }}
            animate={{ height: isCompleted ? 0 : parentHeight }}
            transition={{ type: 'spring', duration: 0.4 }}
            className={`step-content-container ${className}`}
        >
            <AnimatePresence initial={false} mode="sync" custom={direction}>
                {!isCompleted && (
                    <SlideTransition key={currentStep} direction={direction} onHeightReady={h => setParentHeight(h)}>
                        {children}
                    </SlideTransition>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function SlideTransition({ children, direction, onHeightReady }) {
    const containerRef = useRef(null)

    useLayoutEffect(() => {
        if (containerRef.current) {
            onHeightReady(containerRef.current.offsetHeight)
        }
    }, [children, onHeightReady])

    return (
        <motion.div
            ref={containerRef}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        >
            {children}
        </motion.div>
    )
}

const stepVariants = {
    enter: (dir) => ({
        x: dir >= 0 ? '-100%' : '100%',
        opacity: 0
    }),
    center: {
        x: '0%',
        opacity: 1
    },
    exit: (dir) => ({
        x: dir >= 0 ? '50%' : '-50%',
        opacity: 0
    })
}

export function Step({ children }) {
    return <div className="step-content">{children}</div>
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators = false }) {
    const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete'

    const handleClick = () => {
        if (step !== currentStep && !disableStepIndicators) {
            onClickStep(step)
        }
    }

    return (
        <motion.div
            onClick={handleClick}
            className="step-indicator-wrapper"
            animate={status}
            initial={false}
        >
            <motion.div
                variants={{
                    inactive: { scale: 1, backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' },
                    active: { scale: 1, backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-primary)' },
                    complete: { scale: 1, backgroundColor: 'var(--color-accent)', color: 'var(--color-info)' } // Or success color
                }}
                transition={{ duration: 0.3 }}
                className="step-circle"
            >
                {status === 'complete' ? (
                    <CheckIcon className="check-icon" style={{ width: 16, height: 16, color: 'black' }} />
                ) : status === 'active' ? (
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#000' }} />
                ) : (
                    <span style={{ fontSize: '0.875rem' }}>{step}</span>
                )}
            </motion.div>
        </motion.div>
    )
}

function StepConnector({ isComplete, vertical = false }) {
    const lineVariants = {
        incomplete: { width: 0, height: 0, backgroundColor: 'transparent' },
        complete: {
            width: vertical ? '100%' : '100%',
            height: vertical ? '100%' : '100%',
            backgroundColor: 'var(--color-accent)'
        }
    }

    return (
        <div className={`step-connector ${vertical ? 'vertical' : ''}`}>
            <motion.div
                style={{ position: 'absolute', left: 0, top: 0, [vertical ? 'width' : 'height']: '100%' }}
                variants={lineVariants}
                initial={false}
                animate={isComplete ? 'complete' : 'incomplete'}
                transition={{ duration: 0.4 }}
            />
        </div>
    )
}

function CheckIcon(props) {
    return (
        <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                    delay: 0.1,
                    type: 'tween',
                    ease: 'easeOut',
                    duration: 0.3
                }}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
            />
        </svg>
    )
}
