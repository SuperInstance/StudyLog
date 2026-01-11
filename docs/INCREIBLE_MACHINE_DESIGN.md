# StudyLoG.AI: The Incredible Machine - Electronics Edition
## Puzzle-Based Learning through Real Circuit Simulation

**Document Version:** 1.0
**Last Updated:** January 10, 2026
**Maintained By:** SuperInstance.AI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Philosophy](#design-philosophy)
3. [Component Library](#component-library)
4. [Puzzle Mechanics](#puzzle-mechanics)
5. [Level Progression](#level-progression)
6. [Game Modes](#game-modes)
7. [Visual Design System](#visual-design-system)
8. [Physics Simulation](#physics-simulation)
9. [Learning Objectives](#learning-objectives)
10. [Integration Path](#integration-path)
11. [Technical Architecture](#technical-architecture)
12. [Level Designs](#level-designs)
13. [Community & Sharing](#community--sharing)
14. [Appendices](#appendices)

---

## Executive Summary

### Vision Statement

**The Incredible Machine: Electronics Edition** brings the beloved puzzle game mechanics of the 1990s into the modern era of STEM education. Players arrange real electronic components - Arduino boards, sensors, motors, LEDs - to solve chain-reaction puzzles that teach circuit logic, programming fundamentals, and eventually AI hardware concepts.

### Core Concept

```
Traditional Incredible Machine:        StudyLoG.AI Electronics Edition:
--------------------------------        ----------------------------------
Balls, ropes, pulleys, cages           Batteries, wires, resistors, LEDs
Magnets, fans, lasers                  Sensors, motors, servos, buzzers
Rube Goldberg contraptions             Real electronic circuits
Fantasy physics components             Actual Arduino/Jetson components
Win condition: Free the mouse          Win condition: Complete the circuit
```

### Product Integration

This puzzle system serves as the **Cognitive Mill** stage of StudyLoG.AI - the foundational learning experience where students discover how AI models work through hands-on manipulation of the actual hardware that powers them.

**Progression Path:**
```
Cognitive Mill (Puzzles) -> Intelligence Ranch (Agent Training) -> Sitka Sound (Multi-Agent) -> Digital Twins (Hardware)
```

---

## Design Philosophy

### Core Principles

1. **Real Components, Real Learning**
   - Every component is a real electronic part students can buy
   - Simulations accurately model real-world behavior
   - Skills transfer directly to physical hardware

2. **Progressive Disclosure**
   - Start: Simple battery + LED puzzles
   - Progress: Complex logic circuits
   - Advance: Arduino programming
   - Master: Jetson neural network deployment

3. **Play First, Learn Naturally**
   - No lectures before play
   - Discovery through experimentation
   - Tutorial-on-demand when stuck
   - "Aha!" moments drive retention

4. **Community of Creators**
   - Share puzzle solutions
   - Remix other players' contraptions
   - Rate and vote on creations
   - Earn Grain tokens for contributions

### Inspiration: The Incredible Machine (1992-2001)

The original game taught physics through Rube Goldberg machines. We adapt this proven formula:

| TIM Feature | Electronics Edition Equivalent |
|-------------|-------------------------------|
| Free placement of parts | Drag-and-drop circuit components |
| Play/Pause simulation | Real-time circuit simulation |
| Goal objects | Circuit completion conditions |
| Limited parts palette | Component inventory system |
| Hint system | AI tutor hints |
| Multiple solutions | Multiple valid circuit designs |

---

## Component Library

### Overview

All components follow a **blocky/voxel aesthetic** compatible with MicroVerse and Luanti. Each component has:

- Visual representation (2D sprite + 3D voxel model)
- Electrical properties (voltage, current, resistance)
- Physical properties (mass, size, connection points)
- Behavioral rules (simulation logic)
- Educational metadata (difficulty tier, learning objective)

### Component Categories

#### 1. Power Sources

```
Power Category Tier 1 (Basic):
-------------------------------
AA_Battery_1.5V
├── Voltage: 1.5V DC
├── Capacity: 2000 mAh
├── Visual: Cylindrical, positive/negative terminals
├── Connections: 2 (positive, negative)
└── Learning: Basic DC power concept

AAA_Battery_1.5V
├── Voltage: 1.5V DC
├── Capacity: 1000 mAh
├── Visual: Smaller cylinder
└── Learning: Capacity vs size

9V_Battery
├── Voltage: 9V DC
├── Capacity: 500 mAh
├── Visual: Rectangular with snap terminals
└── Learning: Series voltage addition

Coin_Cell_CR2032
├── Voltage: 3V DC
├── Capacity: 220 mAh
├── Visual: Circular disc
└── Learning: Compact power solutions
```

```
Power Category Tier 2 (Intermediate):
--------------------------------------
USB_Power_5V
├── Voltage: 5V DC
├── Current: Up to 500mA
├── Visual: USB connector end
└── Learning: Standardized power delivery

Solar_Panel_Small
├── Voltage: 5V (open circuit)
├── Current: 100mA (max)
├── Visual: Blue grid with leads
└── Learning: Renewable energy, variable output

Power_Breadboard
├── Voltage: User adjustable 1-12V
├── Current: 1A max
├── Visual: Breadboard mount with display
└── Learning: Lab power supply basics
```

```
Power Category Tier 3 (Advanced):
---------------------------------
LiPo_Battery_3S
├── Voltage: 11.1V DC
├── Capacity: 2200 mAh
├── Visual: Rectangular pack with XT60
└── Learning: High-drain applications

AC_Adapter_12V
├── Voltage: 12V DC (converted from AC)
├── Current: 2A max
├── Visual: Wall wart style
└── Learning: AC/DC conversion

Super_Capacitor
├── Voltage: 2.7V
├── Capacity: 10F (yes, farads!)
├── Visual: Cylindrical, larger than capacitor
└── Learning: Energy storage alternative
```

#### 2. Passive Components

```
Passive Category Tier 1:
------------------------
Resistor_Series
├── Values: 100, 220, 330, 470, 1k, 2.2k, 4.7k, 10k ohm
├── Visual: Color-coded bands (accurate)
├── Connections: 2
└── Learning: Ohm's law foundation

LED_Basic_Colors
├── Colors: Red, Green, Yellow, Blue, White
├── Forward voltage: 2-3V
├── Current: 20mA typical
├── Visual: 5mm bulb shape, emits light
└── Learning: Diode behavior, polarity

Switch_SPST
├── Type: Single Pole Single Throw
├── Rating: 250mA
├── Visual: Toggle lever
└── Learning: Circuit control basics

Button_Momentary
├── Type: Normally open
├── Rating: 50mA
├── Visual: Push button
└── Learning: User input, momentary vs latching
```

```
Passive Category Tier 2:
------------------------
Resistor_Variable
├── Range: 0-10k ohm
├── Visual: Knob on top
└── Learning: Analog adjustment

Capacitor_Electrolytic
├── Values: 10uF, 47uF, 100uF, 470uF, 1000uF
├── Visual: Cylindrical, stripe for negative
└── Learning: Energy storage, filtering

Diode_Rectifier
├── Type: 1N4007
├── Rating: 1A, 1000V
├── Visual: Black cylinder with stripe
└── Learning: Current direction control

Transistor_NPN
├── Type: 2N2222
├── Visual: TO-92 package (black, three legs)
└── Learning: Switching and amplification
```

```
Passive Category Tier 3:
------------------------
Potentiometer_Trimmer
├── Range: 0-100k ohm
├── Visual: Small adjustment screw
└── Learning: Calibration

Crystal_Oscillator
├── Frequency: 16MHz
├── Visual: Silver can, two pins
└── Learning: Timing and clock signals

Optocoupler_4N35
├── Type: LED + Phototransistor
├── Visual: 4-pin DIP
└── Learning: Signal isolation

Voltage_Regulator_LM7805
├── Input: 7-20V DC
├── Output: 5V DC regulated
├── Visual: TO-220 with heatsink tab
└── Learning: Voltage regulation
```

#### 3. Sensors

```
Sensor Category Tier 1 (Digital):
----------------------------------
Photoresistor
├── Type: Analog resistance
├── Range: 1k-10k ohm (light dependent)
├── Visual: CdS cell, zigzag pattern
└── Learning: Light sensing

Temperature_Sensor_TMP36
├── Type: Analog voltage output
├── Range: -40C to +125C
├── Visual: TO-92 package (three pins)
└── Learning: Temperature measurement

Button_Matrix_4x4
├── Type: 16 buttons in grid
├── Interface: 8 pins (row/column)
├── Visual: PCB with button array
└── Learning: Input multiplexing
```

```
Sensor Category Tier 2 (Advanced):
----------------------------------
Ultrasonic_Distance_HC-SR04
├── Type: ultrasonic rangefinder
├── Range: 2cm to 400cm
├── Visual: Two cylindrical transducers
└── Learning: Distance measurement

PIR_Motion_HC-SR501
├── Type: Passive Infrared
├── Range: Up to 7 meters
├── Visual: Dome with Fresnel lens
└── Learning: Motion detection

Accelerometer_MPU6050
├── Type: 6-DOF IMU
├── Output: I2C digital
├── Visual: Small PCB module
└── Learning: Orientation sensing

Color_Sensor_TCS3200
├── Type: RGB color detection
├── Output: Frequency based
├── Visual: PCB with clear window
└── Learning: Color recognition
```

```
Sensor Category Tier 3 (Specialized):
-------------------------------------
Camera_OV2640
├── Resolution: Up to 1600x1200
├── Interface: SPI
├── Visual: Module with lens
└── Learning: Image capture basics

Microphone_MAX4466
├── Type: Electret with amplifier
├── Output: Analog voltage
├── Visual: Small PCB with mic element
└── Learning: Sound sensing

GPS_Module_NEO-6M
├── Type: GPS receiver
├── Accuracy: 2.5m
├── Visual: PCB with antenna
└── Learning: Position systems

Air_Quality_Sensor
├── Type: VOC detection
├── Output: Analog voltage
├── Visual: Metal can sensor
└── Learning: Environmental sensing
```

#### 4. Actuators

```
Actuator Category Tier 1 (Basic):
----------------------------------
LED_RGB
├── Type: Common cathode
├── Channels: Red, Green, Blue
├── Visual: Clear 5mm, 4 pins
└── Learning: Color mixing

Buzzer_Passive
├── Type: Piezo
├── Frequency: User defined
├── Visual: Black cylinder with hole
└── Learning: Sound generation

Servo_SG90
├── Type: Hobby servo
├── Range: 0-180 degrees
├── Torque: 1.8 kg-cm
├── Visual: Plastic with horn
└── Learning: Position control
```

```
Actuator Category Tier 2 (Motion):
-----------------------------------
DC_Motor_Small
├── Voltage: 3-6V
├── Speed: 1000-6000 RPM
├── Visual: Metal cylinder with shaft
└── Learning: Continuous rotation

Stepper_Motor_28BYJ-48
├── Type: Unipolar stepper
├── Steps: 2048 per revolution
├── Visual: Round motor with driver board
└── Learning: Precise positioning

Relay_Module_5V
├── Type: SPDT mechanical relay
├── Rating: 10A 250V AC
├── Visual: Blue module with LED indicator
└── Learning: High-power switching

Solenoid_Push
├── Voltage: 5V
├── Stroke: 10mm
├── Visual: Coil with plunger
└── Learning: Linear actuation
```

```
Actuator Category Tier 3 (Display):
-----------------------------------
OLED_Display_128x64
├── Type: SSD1306 I2C
├── Resolution: 128x64 pixels
├── Visual: Small blue screen
└── Learning: Information display

7-Segment_4-Digit
├── Type: Common cathode
├── Interface: 12 pins
├── Visual: Four digits in row
└── Learning: Multiplexed display

Dot_Matrix_8x8
├── Type: LED grid
├── Interface: 16 pins (row/column)
├── Visual: Square of 64 LEDs
└── Learning: Matrix addressing

LCD_16x2_I2C
├── Type: Character LCD
├── Interface: I2C backpack
├── Visual: Blue backlight display
└── Learning: Text display
```

#### 5. Logic Gates (Digital)

```
Logic Gate Components:
----------------------
AND_Gate_74LS08
├── Inputs: 2
├── Output: 1
├── Truth: 0 0->0, 0 1->0, 1 0->0, 1 1->1
├── Visual: D-shape with two inputs
└── Learning: Logical conjunction

OR_Gate_74LS32
├── Inputs: 2
├── Output: 1
├── Truth: 0 0->0, 0 1->1, 1 0->1, 1 1->1
├── Visual: Curved input side
└── Learning: Logical disjunction

NOT_Gate_74LS04
├── Inputs: 1
├── Output: 1
├── Truth: 0->1, 1->0
├── Visual: Triangle with bubble
└── Learning: Logical inversion

NAND_Gate_74LS00
├── Inputs: 2
├── Output: 1
├── Truth: AND output inverted
├── Visual: AND with bubble
└── Learning: Universal gate

XOR_Gate_74LS86
├── Inputs: 2
├── Output: 1
├── Truth: Different inputs = 1
├── Visual: OR with extra line
└── Learning: Exclusive logic

Flip_Flop_D
├── Type: D flip-flop
├── Inputs: D, Clock, Reset
├── Outputs: Q, Q-bar
├── Visual: Rectangle with pins
└── Learning: Memory element

Counter_4_Bit
├── Type: Binary counter
├── Clock: Edge-triggered
├── Outputs: 4-bit binary
├── Visual: 16-pin DIP
└── Learning: Sequential logic
```

#### 6. Microcontrollers

```
Microcontroller Tier 1 (Basic):
-------------------------------
Arduino_Uno_R3
├── MCU: ATmega328P
├── Clock: 16MHz
├── Flash: 32KB
├── RAM: 2KB
├── Digital I/O: 14 (6 PWM)
├── Analog Inputs: 10-bit, 6 channels
├── Visual: Blue board with USB
└── Learning: First microcontroller

Arduino_Nano
├── MCU: ATmega328P
├── Form Factor: Small breadboard compatible
├── Visual: Blue mini board
└── Learning: Compact deployment
```

```
Microcontroller Tier 2 (Advanced):
----------------------------------
Arduino_Mega_2560
├── MCU: ATmega2560
├── Flash: 256KB
├── RAM: 8KB
├── Digital I/O: 54 (15 PWM)
├── Analog Inputs: 16
├── Visual: Large black board
└── Learning: Larger projects

ESP32_DEVKIT
├── MCU: ESP32
├── Clock: 240MHz dual core
├── WiFi: Built-in
├── Bluetooth: Built-in
├── Visual: White/black board with antenna
└── Learning: IoT connectivity

Raspberry_Pi_Pico
├── MCU: RP2040
├── Programmable I/O: Unique feature
├── Visual: Green board with castellated pins
└── Learning: Custom peripherals
```

```
Microcontroller Tier 3 (AI Hardware):
------------------------------------
Jetson_Nano_Developer
├── SoC: Tegra X1 (128 CUDA cores)
├── AI Performance: 472 GFLOPS
├── Memory: 4GB LPDDR4
├── Storage: microSD
├── Video: 4K60 decode, 4K30 encode
├── Power: 5V DC, 4A max
├── Visual: Green module with large heatsink
└── Learning: Edge AI deployment

Coral_TPU_USB
├── Accelerator: Edge TPU
├── Performance: 4 TOPS
├── Interface: USB 3.0
├── Visual: Silver stick with USB
└── Learning: AI acceleration

Arduino_Portenta_H7
├── MCU: STM32H747 dual core
├── AI: On-chip neural network accelerator
├── Visual: Black rectangular module
└── Learning: Industrial AI
```

#### 7. Wiring & Connections

```
Wiring Components:
------------------
Wire_Jumper_MM
├── Type: Male-to-Male
├── Colors: Red, Black, Yellow, Green, Blue, White
├── Visual: Flexible line with connection points
└── Learning: Circuit connections

Wire_Jumper_MF
├── Type: Male-to-Female
├── Visual: Flexible with socket end
└── Learning: Connecting to headers

Breadboard_400
├── Points: 400 tie points
├── Rails: 2 power rails
├── Visual: White plastic with holes
└── Learning: Prototyping surface

Breadboard_830
├── Points: 830 tie points
├── Rails: Split power rails
├── Visual: Larger board
└── Learning: Complex circuits

Screw_Terminal_2P
├── Type: 2-position screw terminal
├── Rating: 10A 300V
├── Visual: Green block with screws
└── Learning: Secure connections

PCB_Generic
├── Type: Custom circuit board
├── User: Place components and traces
├── Visual: Green board with copper
└── Learning: Circuit design
```

---

## Puzzle Mechanics

### Core Gameplay Loop

```
1. PUZZLE START
   ├── Objective presented (e.g., "Light the LED when button pressed")
   ├── Available components displayed in inventory
   └── Play area with fixed/flexible elements

2. PLANNING PHASE (Paused)
   ├── Drag components from inventory
   ├── Rotate and position components
   ├── Create wire connections
   └── Configure component properties

3. SIMULATION PHASE (Running)
   ├── Circuit simulation runs in real-time
   ├── Current flow visualized
   ├── Component states update
   └── Goal conditions checked

4. RESULT
   ├── SUCCESS: Level complete, stars awarded
   ├── FAILURE: Circuit doesn't work, try again
   └── PARTIAL: Hint available
```

### Victory Conditions

Each puzzle has one or more victory conditions:

| Condition Type | Examples | Detection Method |
|----------------|----------|------------------|
| State Change | LED turns on | Digital pin HIGH |
| Threshold | Voltage > 3V | Analog comparison |
| Sequence | Blink 3 times | Pattern matching |
| Duration | Motor runs for 5 seconds | Time-based |
| Combination | Multiple LEDs in pattern | Multi-condition |

### Simulation Physics

```
Circuit Simulation Model:
-------------------------
Voltage Sources:
└── Provides potential difference

Current Flow:
├── I = V / R (Ohm's Law)
├── Flows from high to low potential
└── Visual: Animated particles in wires

Component Behavior:
├── Resistors: Limit current
├── LEDs: Emit light when forward biased
├── Motors: Spin when sufficient current
├── Sensors: Change output based on environment
└── Logic gates: Compute boolean functions

Time Simulation:
├── Discrete time steps (1ms default)
├── User-adjustable speed (0.1x to 10x)
└── Pause/Resume/Step controls
```

### Chain Reactions

The heart of Incredible Machine gameplay:

```
Chain Reaction Example:
-----------------------
1. Button Pressed
   └── Digital pin goes HIGH
       └── Triggers Arduino code
           └── Sets output pin HIGH
               └── Motor rotates
                   └── Arm pushes object
                       └── Object hits limit switch
                           └── Switch triggers LED
                               └── VICTORY!
```

### Feedback Systems

#### Visual Feedback
- **Current Flow:** Animated particles in wires (speed = current magnitude)
- **Voltage Levels:** Color-coded wires (red = high, blue = low)
- **Component States:** LEDs glow, motors spin, displays update
- **Error States:** Smoke effect for overcurrent, sparks for short circuits

#### Audio Feedback
- Click when connections made
- Hum when motors run
- Beep when buzzers activate
- Alarm sound for errors

#### Haptic Feedback (Future)
- Controller vibration when motors activate
- Different patterns for different events

---

## Level Progression

### Overview

```
Level Structure:
├── Tutorial (Levels 1-5): Guided learning
├── Beginner (Levels 6-15): Basic circuits
├── Intermediate (Levels 16-30): Sensors and logic
├── Advanced (Levels 31-45): Microcontrollers
├── Expert (Levels 46-60): AI Hardware
└── Master (Levels 61+): Open challenges
```

### Tier 1: Simple Circuits (Levels 1-10)

**Learning Objectives:**
- Understand voltage, current, resistance
- Learn circuit polarity
- Master series and parallel connections
- Discover Ohm's Law through experimentation

#### Level 1: The Spark (Tutorial)
```
Objective: Light up the LED

Inventory:
├── 9V Battery
├── Red LED
└── 220 Ohm Resistor

Solution: Battery → Resistor → LED → Battery

Concept: Basic circuit, current limiting

Tutorial Dialogue:
Professor Watt: "Welcome, young engineer! Let's start with the basics.
               An LED needs power to glow, but too much current will
               destroy it. We use a resistor to limit the flow.
               Try connecting the components to light the LED!"
```

#### Level 2: Double Trouble
```
Objective: Light both LEDs

Inventory:
├── 9V Battery
├── 2 Red LEDs
└── 2 220 Ohm Resistors

Solution: Parallel circuit

Concept: Parallel connections share voltage
```

#### Level 3: Dim the Lights
```
Objective: Make LED glow at half brightness

Inventory:
├── 9V Battery
├── Red LED
├── 220 Ohm Resistor
└── 470 Ohm Resistor

Solution: Use larger resistor

Concept: Resistance controls current brightness
```

#### Level 4: The Switch
```
Objective: Control LED with button

Inventory:
├── 9V Battery
├── Red LED
├── 220 Ohm Resistor
└── Push Button

Solution: Battery → Resistor → LED → Button → Battery

Concept: Manual control circuit
```

#### Level 5: RGB Mixer
```
Objective: Create yellow light

Inventory:
├── 9V Battery
├── RGB LED
├── 3 220 Ohm Resistors
└── 3 Switches

Solution: Enable Red + Green

Concept: Color mixing (R+G=Y)
```

#### Level 6: Series Circuit
```
Objective: Light 3 LEDs in series

Inventory:
├── 9V Battery
├── 3 Red LEDs
└── Resistor (calculate value needed)

Solution: Series connection with correct resistor

Concept: Voltage division in series
```

#### Level 7: Race Condition
```
Objective: Make motor spin fastest

Inventory:
├── 9V Battery
├── DC Motor
├── Various resistors

Solution: Minimize resistance in motor circuit

Concept: Resistance limits current
```

#### Level 8: The Capacitor Charge
```
Objective: LED fades after button release

Inventory:
├── 9V Battery
├── LED
├── Resistor
├── Capacitor 1000uF
└── Button

Solution: RC circuit with capacitor in parallel

Concept: Capacitors store and release energy
```

#### Level 9: Diode Direction
```
Objective: Current flows only one way

Inventory:
├── 9V Battery
├── 2 LEDs
├── Diode
└── Resistors

Solution: Use diode to block reverse current

Concept: Diodes enforce direction
```

#### Level 10: Voltage Divider
```
Objective: Produce 3V from 9V source

Inventory:
├── 9V Battery
├── Various resistors
└── Voltmeter (readout)

Solution: Calculate divider ratio (1k:2k)

Concept: Voltage division formula
```

### Tier 2: Sensors and Reactions (Levels 11-20)

**Learning Objectives:**
- Understand sensor types and outputs
- Learn analog vs digital signals
- Master comparator circuits
- Discover threshold detection

#### Level 11: Light Switch
```
Objective: LED turns on when room is dark

Inventory:
├── 9V Battery
├── Photoresistor
├── Transistor (NPN)
├── LED
└── Resistors

Solution: Photoresistor controls transistor base

Concept: Sensors as variable resistors
```

#### Level 12: Temperature Alert
```
Objective: Buzzer sounds when temperature rises

Inventory:
├── 9V Battery
├── TMP36 Temperature Sensor
├── Comparator (LM393)
├── Buzzer
└── Resistors/Potentiometer

Solution: Comparator triggers buzzer above threshold

Concept: Comparators and thresholds
```

#### Level 13: The Motion Detector
```
Objective: LED lights when movement detected

Inventory:
├── 9V Battery
├── PIR Motion Sensor
├── LED
└── Resistors

Solution: PIR output directly drives LED

Concept: Digital sensor outputs
```

#### Level 14: Distance Gauge
```
Objective: LED turns on when object is close

Inventory:
├── 9V Battery
├── Ultrasonic Sensor HC-SR04
├── Comparator
├── LED
└── Resistors

Solution: Echo pulse width compared to threshold

Concept: Distance measurement timing
```

#### Level 15: Night Light
```
Objective: Automatic night light that fades in smoothly

Inventory:
├── 9V Battery
├── Photoresistor
├── Transistor array
├── LED
├── Capacitor
└── Resistors

Solution: Multiple transistor stages for smooth fade

Concept: Analog signal processing
```

#### Level 16: The Clap Switch
```
Objective: LED toggles on clap sound

Inventory:
├── 9V Battery
├── Microphone module
├── Comparator
├── Flip-Flop (CD4013)
├── LED
└── Resistors/Capacitors

Solution: Sound pulse triggers flip-flop toggle

Concept: Memory elements, edge triggering
```

#### Level 17: Rainbow Chaser
```
Objective: LEDs cycle colors based on light level

Inventory:
├── 9V Battery
├── Photoresistor
├── RGB LED
├── Multiple comparators
└── Resistors

Solution: Different thresholds for each color

Concept: Multi-level thresholds
```

#### Level 18: The Timer
```
Objective: LED turns on 5 seconds after button press

Inventory:
├── 9V Battery
├── Button
├── 555 Timer IC
├── LED
└── RC components

Solution: 555 timer in monostable mode

Concept: Timing with RC circuits
```

#### Level 19: Pulse Generator
```
Objective: Make LED blink

Inventory:
├── 9V Battery
├── 555 Timer IC
├── LED
└── RC components

Solution: 555 timer in astable mode

Concept: Oscillators, frequency control
```

#### Level 20: The Security System
```
Objective: Alarm triggers if ANY sensor activates

Inventory:
├── 9V Battery
├── PIR Motion Sensor
├── Magnetic Door Sensor
├── 2 LEDs (indicators)
├── Buzzer
└── Logic Gates (OR)

Solution: OR gate combines sensor outputs

Concept: Logic gates for decision making
```

### Tier 3: Logic and Computation (Levels 21-30)

**Learning Objectives:**
- Master all logic gates
- Understand truth tables
- Build combinational circuits
- Learn sequential logic

#### Level 21: The AND Gate
```
Objective: LED lights only when BOTH buttons pressed

Inventory:
├── 9V Battery
├── 2 Buttons
├── AND Gate IC (74LS08)
├── LED
└── Resistors

Solution: Buttons feed AND gate inputs

Concept: Logical conjunction
```

#### Level 22: Voting Machine
```
Objective: LED lights if 2 of 3 agree

Inventory:
├── 9V Battery
├── 3 Buttons
├── AND, OR gates
├── LED
└── Resistors

Solution: Majority voting circuit

Concept: Complex logic combinations
```

#### Level 23: The Half Adder
```
Objective: Add two binary inputs, show sum and carry

Inventory:
├── 9V Battery
├── 2 Switches (binary input)
├── XOR Gate (for sum)
├── AND Gate (for carry)
├── 2 LEDs (output)
└── Resistors

Solution: XOR=Sum, AND=Carry

Concept: Binary addition
```

#### Level 24: The Decoder
```
Objective: Convert 2-bit input to 4-output selection

Inventory:
├── 9V Battery
├── 2 Switches (input)
├── NOT, AND gates
├── 4 LEDs (output)
└── Resistors

Solution: 2-to-4 line decoder

Concept: Address decoding
```

#### Level 25: Binary Counter
```
Objective: Count button presses in binary

Inventory:
├── 9V Battery
├── Button
├── 4 JK Flip-Flops
├── 4 LEDs (output)
└── Resistors

Solution: Ripple counter

Concept: Sequential logic, counting
```

#### Level 26: The Shift Register
```
Objective: Light chaser effect

Inventory:
├── 9V Battery
├── 555 Timer (clock)
├── Shift Register IC (74LS164)
├── 8 LEDs
└── Resistors

Solution: Clock feeds shift register

Concept: Data movement, timing
```

#### Level 27: The 7-Segment Decoder
```
Objective: Display 0-9 based on 4-bit input

Inventory:
├── 9V Battery
├── 4 Switches (binary input)
├── 7447 Decoder IC
├── 7-Segment Display
└── Resistors

Solution: BCD to 7-segment decoder

Concept: Display encoding
```

#### Level 28: Digital Comparator
```
Objective: Indicate if A > B, A = B, or A < B

Inventory:
├── 9V Battery
├── 8 Switches (two 4-bit numbers)
├── 74LS85 Comparator
├── 3 LEDs (output)
└── Resistors

Solution: Magnitude comparison

Concept: Digital comparison
```

#### Level 29: The Memory Cell
```
Objective: Store and recall a bit

Inventory:
├── 9V Battery
├── Write Button
├── Read Button
├── D Flip-Flop
├── Data Switch
├── LED (output)
└── Resistors

Solution: Flip-flop as memory element

Concept: Data storage
```

#### Level 30: The State Machine
```
Objective: Sequence: OFF → RED → GREEN → BLUE → OFF

Inventory:
├── 9V Battery
├── Clock (555 timer)
├── Multiple Flip-Flops
├── Logic gates
├── RGB LED
└── Resistors

Solution: State machine with counters

Concept: State machines, sequencing
```

### Tier 4: Arduino Programming (Levels 31-40)

**Learning Objectives:**
- Understand microcontroller basics
- Learn Arduino IDE integration
- Master digital I/O
- Learn analog inputs and PWM

#### Level 31: Hello Blink
```
Objective: Program Arduino to blink LED

Inventory:
├── Arduino Uno
├── USB Power
├── LED
└── Resistor

Code Concept:
```cpp
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
```

Concept: First Arduino program
```

#### Level 32: Button Input
```
Objective: LED controlled by button via code

Inventory:
├── Arduino Uno
├── Button
├── LED
└── Resistors

Code Concept:
```cpp
void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
```

Concept: Digital input reading
```

#### Level 33: PWM Dimmer
```
Objective: Control LED brightness with potentiometer

Inventory:
├── Arduino Uno
├── Potentiometer
├── LED
└── Resistors

Code Concept:
```cpp
void loop() {
  int potValue = analogRead(POT_PIN);
  int brightness = map(potValue, 0, 1023, 0, 255);
  analogWrite(LED_PIN, brightness);
}
```

Concept: Analog input, PWM output
```

#### Level 34: Serial Monitor
```
Objective: Display sensor reading on computer

Inventory:
├── Arduino Uno
├── Photoresistor
└── Resistors

Code Concept:
```cpp
void loop() {
  int lightValue = analogRead(LIGHT_SENSOR);
  Serial.println(lightValue);
  delay(100);
}
```

Concept: Serial communication
```

#### Level 35: Traffic Light Controller
```
Objective: Proper traffic light sequence

Inventory:
├── Arduino Uno
├── Red, Yellow, Green LEDs
└── Resistors

Code Concept:
```cpp
void loop() {
  setLight(RED);
  delay(5000);
  setLight(YELLOW);
  delay(1000);
  setLight(GREEN);
  delay(5000);
}
```

Concept: Timing and sequencing
```

#### Level 36: The Thermostat
```
Objective: Control fan based on temperature

Inventory:
├── Arduino Uno
├── TMP36 Temperature Sensor
├── DC Motor (fan)
└── Transistor driver

Code Concept:
```cpp
void loop() {
  float temp = readTemperature();
  if (temp > 25.0) {
    analogWrite(FAN_PIN, 255);
  } else if (temp < 23.0) {
    analogWrite(FAN_PIN, 0);
  }
}
```

Concept: Conditional control
```

#### Level 37: Ultrasonic Rangefinder
```
Objective: Display distance on OLED

Inventory:
├── Arduino Uno
├── Ultrasonic Sensor HC-SR04
├── OLED Display
└── Resistors

Code Concept:
```cpp
void loop() {
  long duration = readUltrasonic();
  float distance = duration * 0.034 / 2;
  display.clearDisplay();
  display.println(distance);
  display.display();
}
```

Concept: Sensor integration, display output
```

#### Level 38: Servo Control
```
Objective: Servo follows potentiometer

Inventory:
├── Arduino Uno
├── Potentiometer
├── Servo Motor
└── Resistors

Code Concept:
```cpp
void loop() {
  int potValue = analogRead(POT_PIN);
  int angle = map(potValue, 0, 1023, 0, 180);
  myServo.write(angle);
}
```

Concept: Servo library, mapping
```

#### Level 39: The Reaction Game
```
Objective: Build a reaction time game

Inventory:
├── Arduino Uno
├── 2 Buttons (player LEDs)
├── RGB LED (game indicator)
└── Resistors

Code Concept:
```cpp
// Game state machine
enum State { WAITING, READY, PRESSED, RESULT };
State currentState = WAITING;
unsigned long reactionTime;
```

Concept: Game logic, timing, state management
```

#### Level 40: Data Logger
```
Objective: Log temperature every minute

Inventory:
├── Arduino Uno
├── TMP36 Temperature Sensor
├── EEPROM (or simulated)
└── Resistors

Code Concept:
```cpp
void loop() {
  if (millis() - lastLogTime >= 60000) {
    float temp = readTemperature();
    EEPROM.write(address++, (byte)(temp * 10));
    lastLogTime = millis();
  }
}
```

Concept: Data storage, non-volatile memory
```

### Tier 5: AI Hardware Basics (Levels 41-50)

**Learning Objectives:**
- Understand neural network concepts
- Learn basic machine learning
- Discover edge computing
- Master Jetson basics

#### Level 41: The Perceptron
```
Objective: Implement single neuron behavior

Inventory:
├── Arduino Uno
├── 2 Potentiometers (inputs)
├── LED (output)
└── Resistors

Code Concept:
```cpp
float weights[2] = {0.5, -0.3};
float bias = 0.1;
float inputs[2] = {readPot1(), readPot2()};
float sum = bias;
for (int i = 0; i < 2; i++) {
  sum += inputs[i] * weights[i];
}
int output = (sum > 0) ? HIGH : LOW;
```

Concept: Artificial neuron, weighted sum, activation
```

#### Level 42: Training the Perceptron
```
Objective: Learn AND function

Inventory:
├── Arduino Uno
├── 2 Switches (inputs)
├── 2 LEDs (expected, actual output)
├── Train Button
└── Resistors

Code Concept:
```cpp
void train(int input0, int input1, int target) {
  int guess = predict(input0, input1);
  int error = target - guess;
  weights[0] += learningRate * error * input0;
  weights[1] += learningRate * error * input1;
  bias += learningRate * error;
}
```

Concept: Learning rule, weight adjustment
```

#### Level 43: Pattern Recognition
```
Objective: Recognize simple patterns

Inventory:
├── Arduino Uno
├── 4x4 Button Matrix (16 inputs)
├── 4 LEDs (pattern class output)
└── Resistors

Code Concept:
```cpp
int predictPattern(int inputs[16]) {
  float sum = bias;
  for (int i = 0; i < 16; i++) {
    sum += inputs[i] * weights[i];
  }
  return (sum > threshold);
}
```

Concept: Pattern classification
```

#### Level 44: The Multi-Layer Network
```
Objective: Implement 2-layer network

Inventory:
├── Arduino Uno
├── 2 Potentiometers (inputs)
├── RGB LED (3 hidden neurons)
├── LED (output)
└── Resistors

Code Concept:
```cpp
float hiddenLayer[3];
float outputLayer;

void forwardPropagate() {
  for (int h = 0; h < 3; h++) {
    float sum = hiddenBias[h];
    for (int i = 0; i < 2; i++) {
      sum += inputs[i] * weightsIH[i][h];
    }
    hiddenLayer[h] = activate(sum);
  }
  // Similar for output layer
}
```

Concept: Multi-layer networks, hidden layers
```

#### Level 45: Jetson Hello World
```
Objective: First Jetson program - blink LED

Inventory:
├── Jetson Nano
├── LED
└── Resistor

Code Concept:
```python
import RPi.GPIO as GPIO
import time

LED_PIN = 18
GPIO.setup(LED_PIN, GPIO.OUT)
while True:
    GPIO.output(LED_PIN, GPIO.HIGH)
    time.sleep(1)
    GPIO.output(LED_PIN, GPIO.LOW)
    time.sleep(1)
```

Concept: Jetson GPIO, Python
```

#### Level 46: Camera Capture
```
Objective: Display camera feed

Inventory:
├── Jetson Nano
├── Camera Module
└── Display (HDMI)

Code Concept:
```python
import cv2
cap = cv2.VideoCapture(0)
while True:
    ret, frame = cap.read()
    cv2.imshow('Camera', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
```

Concept: OpenCV, camera interface
```

#### Level 47: Color Detection
```
Objective: Detect red objects in camera view

Inventory:
├── Jetson Nano
├── Camera Module
├── LED (indicator)
└── Resistors

Code Concept:
```python
hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
lower_red = np.array([0, 100, 100])
upper_red = np.array([10, 255, 255])
mask = cv2.inRange(hsv, lower_red, upper_red)
if cv2.countNonZero(mask) > threshold:
    GPIO.output(LED_PIN, GPIO.HIGH)
```

Concept: Color spaces, filtering
```

#### Level 48: The Face Detector
```
Objective: Detect faces, draw boxes

Inventory:
├── Jetson Nano
├── Camera Module
└── Display

Code Concept:
```python
import cv2
face_cascade = cv2.CascadeClassifier(
    'haarcascade_frontalface_default.xml'
)
faces = face_cascade.detectMultiScale(gray, 1.3, 5)
for (x, y, w, h) in faces:
    cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
```

Concept: Haar cascades, detection
```

#### Level 49: Object Classification
```
Objective: Classify objects using pre-trained model

Inventory:
├── Jetson Nano
├── Camera Module
└── Display

Code Concept:
```python
import jetson.inference
import jetson.utils

net = jetson.inference.detectNet(
    "ssd-mobilenet-v2", threshold=0.5
)
cuda_img = jetson.utils.cudaFromNumpy(frame)
detections = net.Detect(cuda_img)
for d in detections:
    print(d.ClassID, d.Confidence, d.Left, d.Top)
```

Concept: Neural network inference, object detection
```

#### Level 50: The Smart Doorbell
```
Objective: Ring when person detected

Inventory:
├── Jetson Nano
├── Camera Module
├── Buzzer
├── Relay (doorbell)
└── Resistors

Code Concept:
```python
detections = net.Detect(cuda_img)
person_detected = any(
    d.ClassID == net.GetClassDesc("person")
    for d in detections
)
if person_detected and not recently_rang:
    ring_doorbell()
```

Concept: Real-world AI application
```

### Tier 6: Advanced AI Systems (Levels 51-60)

**Learning Objectives:**
- Build complete AI systems
- Understand model deployment
- Learn optimization techniques
- Create edge AI solutions

#### Level 51: Gesture Recognition
```
Objective: Control servo with hand gestures

Inventory:
├── Jetson Nano
├── Camera Module
├── Servo Motor
└── Resistors

Concept: MediaPipe, gesture classification
```

#### Level 52: Voice Commands
```
Objective: Control LEDs with voice

Inventory:
├── Jetson Nano
├── Microphone
├── Multiple LEDs
└── Resistors

Concept: Speech recognition, keyword spotting
```

#### Level 53: The Line Following Robot
```
Objective: Build and train line follower

Inventory:
├── Jetson Nano
├── Camera Module (downward facing)
├── 2 DC Motors
├── Motor Driver
└── Chassis (simulated)

Concept: Computer vision, motor control
```

#### Level 54: Emotion Detector
```
Objective: Detect facial emotions

Inventory:
├── Jetson Nano
├── Camera Module
├── RGB LED (emotion indicator)
└── Resistors

Concept: Facial expression recognition
```

#### Level 55: The Smart Plant Monitor
```
Objective: Monitor plant health with camera

Inventory:
├── Jetson Nano
├── Camera Module
├── Soil Moisture Sensor
├── Water Pump
└── Resistors

Concept: Multi-sensor AI system
```

#### Level 56: Object Tracking
```
Objective: Track and follow object

Inventory:
├── Jetson Nano
├── Camera Module
├── 2 Servos (pan/tilt)
└── Resistors

Concept: Object tracking, servo coordination
```

#### Level 57: Person Counter
```
Objective: Count people passing through

Inventory:
├── Jetson Nano
├── Camera Module
├── OLED Display (count)
└── Resistors

Concept: Tracking logic, counting algorithm
```

#### Level 58: The Security Camera
```
Objective: Record on motion detection

Inventory:
├── Jetson Nano
├── Camera Module
├── PIR Sensor
├── Storage (simulated)
└── Resistors

Concept: Event-driven recording
```

#### Level 59: License Plate Reader
```
Objective: Read and display license plates

Inventory:
├── Jetson Nano
├── Camera Module
├── OLED Display
└── Resistors

Concept: OCR, text recognition
```

#### Level 60: The AI Assistant
```
Objective: Voice-controlled assistant

Inventory:
├── Jetson Nano
├── Camera Module
├── Microphone
├── Speaker
├── Multiple peripherals
└── Resistors

Concept: Multi-modal AI integration
```

### Tier 7: Master Challenges (Levels 61+)

Open-ended challenges requiring creative solutions:

#### Level 61: Autonomous Maze Solver
```
Objective: Navigate maze without prior map

Inventory: Full component palette

Concept: SLAM, pathfinding
```

#### Level 62: The Sorting Machine
```
Objective: Sort objects by color/size

Inventory: Full component palette

Concept: Computer vision, robotics
```

#### Level 63: Weather Station
```
Objective: Predict weather from sensors

Inventory: Full component palette

Concept: Data analysis, prediction
```

---

## Game Modes

### 1. Story Mode

```
Chapter Structure:
├── Chapter 1: The Workshop (Levels 1-10)
│   └── Theme: Learning basic circuits
├── Chapter 2: The Laboratory (Levels 11-20)
│   └── Theme: Sensors and automation
├── Chapter 3: The Factory (Levels 21-30)
│   └── Theme: Logic and computation
├── Chapter 4: The Robot Academy (Levels 31-40)
│   └── Theme: Microcontroller programming
├── Chapter 5: The AI Research Lab (Levels 41-50)
│   └── Theme: Machine learning basics
└── Chapter 6: The Innovation Hub (Levels 51+)
    └── Theme: Advanced applications
```

**Story Premise:**
You are a new engineer at **FutureTech Industries**, working under the brilliant but eccentric **Professor Ada Watt**. Together, you'll solve increasingly complex challenges, from simple lighting circuits to full AI systems.

### 2. Puzzle Mode

Individual levels with:
- Star rating (1-3 stars based on efficiency)
- Time attack mode
- Component count challenges
- Minimum wire usage

### 3. Sandbox Mode

Free creation environment:
- Access to all unlocked components
- No objectives, pure experimentation
- Save/load contraptions
- Share with community

### 4. Daily Challenge

New puzzle every day:
- Global leaderboards
- Limited component palette
- Unique constraints
- Special rewards

### 5. Community Lab

Browse and play community creations:
- Rate and review
- Fork (copy) and modify
- Submit merge requests
- Earn Grain tokens for quality contributions

### 6. Tutorial Mode

Interactive lessons:
- Video walkthroughs
- Step-by-step guidance
- Concept explanations
- Quiz checkpoints

### 7. Challenge Editor

Create your own puzzles:
- Set victory conditions
- Define available components
- Place fixed elements
- Write hints and objectives
- Publish to community

---

## Visual Design System

### Art Style: Blocky/Voxel Aesthetic

Inspired by MicroVerse, Minecraft, and Luanti - blocky components that feel tangible and satisfying to place.

```
Visual Design Principles:
├── Isometric 2D view (base layer)
├── Voxel 3D view (advanced layer)
└── Full 3D view (OpenRTS layer)

Component Rendering:
├── Clear connection points (highlight on hover)
├── Color-coded by function
│   ├── Red: Power sources
│   ├── Blue: Inputs/sensors
│   ├── Green: Outputs/actuators
│   ├── Yellow: Logic/processing
│   └── Gray: Passive/wiring
├── Animated states when active
└── Particle effects for current flow
```

### UI Design

```
Screen Layout:
┌─────────────────────────────────────────────────────────┐
│ Header: Level Name | Stars | Time | Components Used      │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│  Component      │         Play Area                     │
│  Inventory      │    (Circuit Board)                    │
│                 │                                       │
│  ┌───────────┐  │                                       │
│  │ Battery   │  │         [Place components here]       │
│  │ LED       │  │                                       │
│  │ Resistor  │  │                                       │
│  │ Switch    │  │                                       │
│  │ ...       │  │                                       │
│  └───────────┘  │                                       │
│                 │                                       │
├─────────────────┴───────────────────────────────────────┤
│ Controls: Play | Pause | Step | Reset | Hint | Settings │
└─────────────────────────────────────────────────────────┘
```

### Feedback Visualization

```
Current Flow:
├── Yellow particles moving through wires
├── Speed proportional to current
├── Direction from + to -

Voltage Levels:
├── Wire color gradient (blue=low, red=high)
├── Numeric labels on hover
├── Warning colors for dangerous levels

Component States:
├── LEDs: Glow effect (brightness = actual)
├── Motors: Rotation animation
├── Sensors: Value readout
├── Logic gates: Input/output indicators

Error States:
├── Short circuit: Sparks + smoke
├── Overcurrent: Component shakes + turns red
├── Open circuit: "X" indicator
└── Wrong connection: Buzz sound
```

### Progression Visuals

```
Level Select Screen:
├── Map of themed areas
├── Paths unlock as levels complete
├── Star progress per level
├── Boss/Challenge levels marked specially
└── Locked levels show required components

Skill Tree:
├── Circuit Theory (unlock components)
├── Programming (unlock code blocks)
├── AI/ML (unlock models)
└── Robotics (unlock advanced parts)
```

---

## Physics Simulation

### Circuit Simulation Engine

```
Simulation Architecture:
├── Modified Nodal Analysis (MNA)
├── Discrete time stepping (configurable)
├── Component-level modeling
└── Real-time visualization

Component Models:
├── Ideal voltage source
├── Ideal current source
├── Resistor (Ohmic)
├── Capacitor (energy storage)
├── Inductor (magnetic storage)
├── Diode (exponential model)
├── Transistor (Ebers-Moll)
└── Digital (ideal logic)
```

### Simulation Accuracy

```
Accuracy vs Performance Trade-off:
├── Fast Mode: Simplified models, 60 FPS
├── Normal Mode: Standard SPICE-like, 30 FPS
├── Accurate Mode: Full models, 10 FPS
└── Real Mode: Connect to actual hardware
```

### Connection with Real Hardware

```
Real Hardware Bridge:
├── Arduino connected via USB
├── Circuit uploaded to board
├── Real sensors drive simulation
└── Simulation drives real actuators

Benefits:
├── Verify in simulation first
├── Deploy to real hardware
├── Compare simulated vs actual
└── Learn real-world constraints
```

---

## Learning Objectives

### By Tier

```
Tier 1 (Simple Circuits):
├── Understand voltage, current, resistance
├── Learn Ohm's Law through experimentation
├── Master series and parallel connections
└── Discover polarity and circuit direction

Tier 2 (Sensors):
├── Understand analog vs digital signals
├── Learn sensor types and applications
├── Master threshold detection
└── Discover signal conditioning

Tier 3 (Logic):
├── Master all logic gates
├── Understand truth tables
├── Build combinational circuits
└── Learn sequential logic

Tier 4 (Arduino):
├── Microcontroller basics
├── Digital I/O
├── Analog inputs and PWM
├── Serial communication
└── Basic programming concepts

Tier 5 (AI Hardware):
├── Neural network concepts
├── Perceptron and activation functions
├── Forward propagation
├── Computer vision basics
└── Edge AI deployment

Tier 6 (Advanced):
├── Model optimization
├── Multi-modal AI
├── Real-time processing
└── System integration
```

### Skills Mapped to Real-World

```
In-Game Skill → Real-World Application
────────────────────────────────────────
Circuit design → Electronics prototyping
Arduino code → Embedded systems programming
Neural networks → AI/ML engineering
Computer vision → Image processing
System integration → IoT development
```

---

## Integration Path

### Phase 1: MicroVerse (2D Blocky)

```
Implementation:
├── Godot 2D scene
├── Blocky component sprites
├── Grid-based placement
├── Simple current visualization
└── Touch/mouse controls

Target: Mobile, tablets, low-end devices
```

### Phase 2: Luanti (3D Voxel)

```
Implementation:
├── Luanti mod
├── 3D voxel component models
├── First-person placement
├── Multiplayer support
└── World-scale circuits

Target: Education servers, collaborative building
```

### Phase 3: OpenRTS (Full 3D Lab)

```
Implementation:
├── Godot 3D with realistic rendering
├── High-quality component models
├── Physics-based interactions
├── VR support
└── Real hardware integration

Target: Desktop, high-end hardware, VR
```

### Cross-Platform Data

```
Millfile.toml Format:
[meta]
title = "Basic Circuit"
author = "learner123"
tier = 1
level = 1

[components]
battery = "9V_Battery"
led = "Red_LED"
resistor = "220_Ohm"

[connections]
c1 = "battery.positive -> resistor.1"
c2 = "resistor.2 -> led.anode"
c3 = "led.cathode -> battery.negative"

[code]
arduino = """void setup() { pinMode(13, OUTPUT); }"""
```

---

## Technical Architecture

### Godot Implementation

```
Scene Structure:
res://scenes/
├── PuzzleGame.tscn (main game scene)
│   ├── UI/
│   │   ├── InventoryPanel.tscn
│   │   ├── PlayArea.tscn
│   │   └── Controls.tscn
│   ├── Components/
│   │   ├── Component.tscn (base)
│   │   ├── PowerSource.tscn
│   │   ├── LED.tscn
│   │   └── ...
│   └── Systems/
│       ├── CircuitSimulator.gd
│       ├── ComponentManager.gd
│       └── SaveLoad.gd
```

### Circuit Simulator

```gdscript
# CircuitSimulator.gd
extends Node

class_name CircuitSimulator

signal simulation_tick(time: float)
signal component_state_changed(component: Node, state: Dictionary)

var components: Array[Component] = []
var connections: Array[Connection] = []
var time_step: float = 0.001  # 1ms
var simulation_speed: float = 1.0
var is_running: bool = false

func _process(delta: float) -> void:
	if not is_running:
		return

	var sim_delta = delta * simulation_speed
	var steps = int(sim_delta / time_step)

	for i in range(steps):
		_simulation_step(time_step)
		simulation_tick.emit(time * time_step)

func _simulation_step(dt: float) -> void:
	# Build nodal equations
	var equations = _build_equations()

	# Solve for node voltages
	var voltages = _solve_circuit(equations)

	# Update component states
	for component in components:
		component.update(voltages, dt)

func _build_equations() -> Dictionary:
	# Modified Nodal Analysis
	var equations = {}
	# ... implementation
	return equations
```

### Component Base Class

```gdscript
# Component.gd
extends Area2D

class_name Component

enum ComponentType {
	POWER_SOURCE,
	PASSIVE,
	SENSOR,
	ACTUATOR,
	LOGIC,
	MICROCONTROLLER
}

@export var component_type: ComponentType
@export var component_name: String
@export var pins: Array[Pin] = []

var state: Dictionary = {}
var connections: Dictionary = {}  # Pin index -> connected component/pin

signal state_changed(new_state: Dictionary)

func get_pin_position(pin_index: int) -> Vector2:
	return pins[pin_index].global_position

func connect_pin(pin_index: int, other_component: Component, other_pin: int) -> void:
	connections[pin_index] = {
		"component": other_component,
		"pin": other_pin
	}

func update(voltages: Dictionary, dt: float) -> void:
	# Override in subclasses
	pass
```

### Theia Bridge Integration

```gdscript
# Sync circuit state to Theia IDE
func broadcast_circuit_state() -> void:
	var circuit_data = {
		"components": [],
		"connections": [],
		"simulation": {
			"running": is_running,
			"time": current_time
		}
	}

	for component in components:
		circuit_data["components"].append({
			"type": component.component_name,
			"position": component.global_position,
			"state": component.state
		})

	SIBridge.send_theia("circuit_update", circuit_data)
```

---

## Community & Sharing

### The Bazaar Integration

```
Publishing Flow:
1. Complete puzzle with solution
2. Verify circuit works
3. Write description and hints
4. Set difficulty rating
5. Publish to Bazaar
6. Community rates and reviews

Forking Flow:
1. Find interesting puzzle
2. Click "Fork" button
3. Modify in Sandbox
4. Submit merge request to original
5. Creator reviews and approves
```

### Grain Token Economy

```
Earning Grain:
├── +10 Grains: Complete a level (3 stars)
├── +25 Grains: Create a puzzle
├── +50 Grains: Your puzzle gets 5 stars
├── +100 Grains: Fork gets merged
└── +500 Grains: Featured puzzle

Spending Grain:
├── 50 Grains: Unlock hint on level
├── 100 Grains: Skip difficult level
├── 200 Grains: Unlock premium components
└── 500 Grains: Early access to new content
```

### Quality System (Fuse Grade)

```
Fuse Grades:
├── Grade 1 (Experimental): New upload, untested
├── Grade 2 (Functional): Verified to work
├── Grade 3 (Quality): High ratings, good design
└── Grade 4 (Excellent): Community favorite

Grade Promotion:
├── Automatic: Based on ratings
├── Manual: Community voting
└── Admin: Featured puzzles
```

---

## Appendices

### Appendix A: Component Reference Card

```
Quick Reference: Common Components

Component    | Symbol | V   | I    | Notes
-------------|--------|-----|------|------------------
9V Battery   | (+ -) | 9V | 500mA | DC source
LED Red      | →|    | 2V | 20mA | Polarity matters
Resistor     | [~~~] | -   | -     | R = V/I
Button       | _/_   | -   | -     | Momentary
Photoresistor| [⌢]   | -   | Var   | Light → R
Servo SG90   | Ⓜ     | 5V | -     | 0-180 deg
Arduino Uno  | []    | 5V | -     | Programmable
```

### Appendix B: Formula Reference

```
Essential Formulas:

Ohm's Law:
V = I × R
I = V / R
R = V / I

Power:
P = V × I
P = I² × R
P = V² / R

Series Resistance:
R_total = R1 + R2 + R3 + ...

Parallel Resistance:
1/R_total = 1/R1 + 1/R2 + 1/R3 + ...

Voltage Divider:
V_out = V_in × (R2 / (R1 + R2))

LED Resistor:
R = (V_source - V_LED) / I_LED

RC Time Constant:
τ = R × C

Neural Network (Perceptron):
output = activate(Σ(inputs × weights) + bias)
```

### Appendix C: Arduino Pin Reference

```
Arduino Uno Pin Mapping:

Digital Pins (0-13):
├── 0, 1: Serial (RX, TX) - avoid if using Serial
├── 2, 3: External interrupts
├── 3, 5, 6, 9, 10, 11: PWM (~)
├── 10, 11, 12, 13: SPI (MOSI, MISO, SCK, SS)
└── 13: Built-in LED

Analog Pins (A0-A5):
├── A0-A5: Analog input (10-bit, 0-1023)
├── A4, A5: I2C (SDA, SCL)
└── Can be used as digital (14-19)

Power:
├── 3.3V: 3.3V output
├── 5V: 5V output
├── GND: Ground pins (3)
├── Vin: Voltage input (7-12V)
└── Reset: Reset button
```

### Appendix D: Jetson Nano Pin Reference

```
Jetson Nano GPIO Header (40-pin):

Power Pins:
├── 2, 4: 5V DC
├── 1, 17: 3.3V DC
├── 6, 9, 14, 20, 25, 30, 34, 39: GND
└── 2, 4: 5V (not recommended for high current)

GPIO Pins (Numbered as Pi):
├── 7, 11, 12, 13, 15, 16, 18, 22, 29, 31, 32, 33, 35, 36, 37, 38, 40
└── Configurable as input/output

I2C:
├── 3: SDA1 (I2C1)
└── 5: SCL1 (I2C1)

SPI:
├── 19: MOSI
├── 21: MISO
├── 23: SCLK
└── 24: CS0

UART:
├── 8, 10: Serial0 (TX, RX)
└── Console enabled by default
```

### Appendix E: Glossary

```
Electronics Terms:
├── Voltage: Electrical potential difference (V)
├── Current: Flow of electrons (A)
├── Resistance: Opposition to current (Ω)
├── Power: Rate of energy transfer (W)
├── Anode: Positive terminal (diode/LED)
├── Cathode: Negative terminal
├── Forward bias: Current flows (diode)
├── Reverse bias: Current blocked
├── PWM: Pulse Width Modulation
├── Duty cycle: Percentage ON time
├── Analog: Continuous values
├── Digital: Discrete (0/1) values
├── Pull-up: Resistor to VCC
├── Pull-down: Resistor to GND
└── Debounce: Clean switch signal

AI/ML Terms:
├── Neuron: Processing unit
├── Weight: Connection strength
├── Bias: Activation threshold
├── Activation: Non-linear function
├── Forward pass: Compute output
├── Training: Adjust weights
├── Loss function: Error measure
├── Epoch: One training pass
├── Inference: Using trained model
├── Edge AI: On-device processing
└── TPU: Tensor Processing Unit
```

### Appendix F: Learning Resources

```
Recommended Follow-up Resources:

Electronics:
├── Arduino: Official Starter Guide
├── Adafruit: Learning System
├── SparkFun: Tutorials
└── All About Circuits: Textbook

Programming:
├── Arduino Language Reference
├── C++ for Arduino
├── Python for Jetson
└── OpenCV Documentation

AI/ML:
├── Neural Networks and Deep Learning (Nielsen)
├── Fast.ai Practical Deep Learning
├── Jetson AI Lab (NVIDIA)
└── TensorFlow Lite for Microcontrollers

Hardware:
├── Arduino Uno Datasheet
├── Jetson Nano Developer Kit Guide
├── Component Datasheets (always reference!)
└── Schematic Reading Tutorials
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-10 | Initial design document |

---

## Contributing

This design document is part of the SuperInstance.AI ecosystem. To contribute:

1. Fork the repository
2. Create a design branch
3. Submit design changes via PR
4. Discuss in the design review process

For questions or suggestions, please open an issue on the StudyLoG.AI repository.

---

**Remember:** Every puzzle solved is a step toward understanding the AI that powers our future. Happy building!
