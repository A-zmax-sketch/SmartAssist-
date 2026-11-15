Pod::Spec.new do |s|
  s.name           = 'ScreenReader'
  s.version        = '1.0.0'
  s.summary        = "SmartAssist on iPhone: Speak Screen status, voice commands and Siri shortcuts."
  s.description    = "SmartAssist on iPhone: Speak Screen status, voice commands and Siri shortcuts."
  s.license        = 'UNLICENSED'
  s.author         = 'Classis Crimson'
  s.homepage       = 'https://github.com/A-zmax-sketch/SmartAssist-'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.frameworks = 'Speech', 'AVFoundation'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
