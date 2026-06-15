import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

/**
 * Crée une ligne de boutons de confirmation (Confirmer/Annuler)
 */
export function createConfirmationRow(customIds?: {
  confirm?: string;
  cancel?: string;
}): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customIds?.confirm || 'confirm')
      .setLabel('Confirmer')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(customIds?.cancel || 'cancel')
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );
}

/**
 * Crée un bouton personnalisé
 */
export function createButton(
  customId: string,
  label: string,
  style: ButtonStyle = ButtonStyle.Primary,
  emoji?: string,
  disabled = false
): ButtonBuilder {
  const button = new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);

  if (emoji) {
    button.setEmoji(emoji);
  }

  return button;
}

/**
 * Crée un menu de sélection de string
 */
export function createSelectMenu(
  customId: string,
  placeholder: string,
  options: Array<{ label: string; value: string; description?: string; emoji?: string }>,
  minValues = 1,
  maxValues = 1
): ActionRowBuilder<StringSelectMenuBuilder> {
  const selectOptions = options.map((option) => {
    const selectOption = new StringSelectMenuOptionBuilder()
      .setLabel(option.label)
      .setValue(option.value);

    if (option.description) selectOption.setDescription(option.description);
    if (option.emoji) selectOption.setEmoji(option.emoji);

    return selectOption;
  });

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(...selectOptions)
      .setMinValues(minValues)
      .setMaxValues(maxValues)
  );
}








