# Skill: Behavior Vision AI (@media/behavior-vision-ai)

## Purpose
This skill provides specialized algorithms for visual behavior analysis in children with autism, specifically focusing on video-based markers.

## Capabilities
- **detectEyeContact(videoPath: string)**:
  - Analyzes facial landmarks and gaze vectors.
  - Returns: `eyeContactPercentage` (0-100%).
- **analyzeStimming(behaviorData: any)**:
  - Identifies repetitive motor patterns (e.g., hand flapping, rocking).
  - Returns: `stimmingIntensity` (Low/Medium/High) and `frequency`.

## Contextual Knowledge
- Focuses on the "16 key facial landmarks" for autism screening.
- Calibrated to ignore lighting variations and common household backgrounds (e.g., clutter).
- Prioritizes accuracy in "Clinical View" (close-up) and "POV View".
